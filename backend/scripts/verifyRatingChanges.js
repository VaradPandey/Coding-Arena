const axios = require('axios');
const pool = require('../src/config/db');
const matchService = require('../src/modules/matches/match.service');
const { redisClient } = require('../src/redis/client');

async function verify() {
  console.log('--- 1. Testing New User Registration Rating ---');
  const timestamp = Date.now();
  const testUser = {
    username: `zero_test_${timestamp.toString().slice(-6)}`,
    email: `zero_${timestamp}@example.com`,
    password: 'Password123!'
  };

  let user1Id, user2Id, matchId;

  try {
    const regRes = await axios.post('http://localhost:5000/api/auth/register', testUser);
    console.log('Registration Response Status:', regRes.status);
    const userData = regRes.data.data.user;
    console.log('Registered User in API response:', userData);

    if (userData.rating !== 0) {
      throw new Error(`Expected rating to be 0, but got ${userData.rating}`);
    }

    const dbUserRes = await pool.query('SELECT id, username, rating, "maxRating" FROM users WHERE id = $1', [userData.id]);
    const dbUser = dbUserRes.rows[0];
    console.log('Database User Record:', dbUser);

    if (dbUser.rating !== 0 || dbUser.maxRating !== 0) {
      throw new Error(`Expected db rating and maxRating to be 0, but got ${dbUser.rating}, ${dbUser.maxRating}`);
    }
    console.log('✅ Requirement 1 Passed: New user starts with 0 rating & 0 maxRating.');

    console.log('\n--- 2. Verifying Existing Users Were NOT Reset ---');
    const existingRes = await pool.query('SELECT username, rating, "maxRating" FROM users WHERE rating > 0 LIMIT 5');
    console.log('Existing users with ratings > 0:');
    console.table(existingRes.rows);
    if (existingRes.rows.length === 0) {
      throw new Error('All users have 0 rating! Existing users might have been overwritten.');
    }
    console.log('✅ Requirement 2 Passed: Existing user ratings were preserved.');

    console.log('\n--- 3. Verifying Loss Point Deduction Floor (Never Below 0) ---');
    // Create an opponent
    const oppRes = await axios.post('http://localhost:5000/api/auth/register', {
      username: `opp_test_${timestamp.toString().slice(-6)}`,
      email: `opp_${timestamp}@example.com`,
      password: 'Password123!'
    });

    user1Id = userData.id; // rating 0
    user2Id = oppRes.data.data.user.id; // rating 0

    // Create match using matchService
    matchId = `room_test_${timestamp}`;
    await matchService.createMatch(matchId, user1Id, user2Id);

    // Set Redis room state
    await redisClient.set(matchId, JSON.stringify({
      roomId: matchId,
      mode: 'ranked',
      scores: {
        [user1Id]: 0,
        [user2Id]: 100
      },
      penalties: {
        [user1Id]: 0,
        [user2Id]: 0
      }
    }), 'EX', 3600);

    // Finalize match: user2 wins by higher score, user1 (loser) rating is 0
    const finalizeResult = await matchService.finalizeMatch(matchId, null, 'TIME_EXPIRED');
    console.log('Finalize Match Result Ratings:');
    console.log(JSON.stringify(finalizeResult.ratings, null, 2));

    const p1RatingResult = finalizeResult.ratings[user1Id];
    console.log(`User1 (loser) rating went from ${p1RatingResult.old} to ${p1RatingResult.new} (diff: ${p1RatingResult.diff})`);

    if (p1RatingResult.new < 0) {
      throw new Error(`Loser rating dropped below 0! (${p1RatingResult.new})`);
    }

    const updatedUser1 = await pool.query('SELECT rating FROM users WHERE id = $1', [user1Id]);
    console.log('User1 rating in Postgres after loss:', updatedUser1.rows[0].rating);
    if (updatedUser1.rows[0].rating < 0) {
      throw new Error(`Loser DB rating dropped below 0! (${updatedUser1.rows[0].rating})`);
    }

    console.log('✅ Requirement 3 Passed: Rating deduction is strictly floored at 0.');
    console.log('\n🎉 ALL RATING REQUIREMENTS VERIFIED SUCCESSFULLY!');
  } catch (err) {
    console.error('Verification failed:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
    }
    process.exit(1);
  } finally {
    // Cleanup test data
    console.log('\n--- Cleaning up test records ---');
    if (matchId) {
      await pool.query('DELETE FROM "Match" WHERE "roomId" = $1', [matchId]);
      await redisClient.del(matchId);
    }
    if (user1Id || user2Id) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [[user1Id, user2Id].filter(Boolean)]);
    }
    console.log('Cleaned up test data.');
    await pool.end();
    await redisClient.quit();
  }
}

verify();
