import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { submissionApi } from '@/api/submissions';
import { PageWrapper, Container } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Code2, 
  Copy, 
  Check, 
  ArrowLeft, 
  ShieldAlert, 
  Lock, 
  Loader2,
  FileCode,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeSlideUp } from '@/lib/motion';

export default function SubmissionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data: resp, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['submission', id],
    queryFn: () => submissionApi.getSubmission(id),
    retry: 1,
  });

  const submission = resp?.data || resp;
  const isForbidden = error?.response?.status === 403;
  const isNotFound = error?.response?.status === 404;

  const handleCopyCode = () => {
    if (submission?.source_code) {
      navigator.clipboard.writeText(submission.source_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getVerdictBadge = (verdict, status) => {
    const v = verdict || status;
    if (v === 'Accepted') {
      return (
        <Badge variant="success" className="px-3 py-1 text-sm font-semibold flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-4 h-4" />
          Accepted
        </Badge>
      );
    }
    if (v === 'queued' || v === 'running') {
      return (
        <Badge variant="warning" className="px-3 py-1 text-sm font-semibold flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
          <Clock className="w-4 h-4 animate-spin" />
          {v === 'queued' ? 'Queued' : 'Executing...'}
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="px-3 py-1 text-sm font-semibold flex items-center gap-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/30">
        <XCircle className="w-4 h-4" />
        {v || 'Failed'}
      </Badge>
    );
  };

  return (
    <PageWrapper>
      <Container className="py-8 max-w-4xl space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-xs px-2.5">
            <Link to="/dashboard">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </Link>
          </Button>
          <span>/</span>
          <span className="text-foreground font-mono">Submission #{id}</span>
        </div>

        {/* Loading State */}
        {isLoading && (
          <Card className="border-border/50 bg-card/40 p-16 text-center">
            <div className="flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Retrieving submission details...</p>
            </div>
          </Card>
        )}

        {/* 403 Forbidden State */}
        {isForbidden && (
          <Card className="border-rose-500/30 bg-rose-500/5 p-8 text-center space-y-4">
            <Lock className="w-12 h-12 text-rose-400 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                You do not have permission to inspect this submission. Submissions are strictly private to their respective authors.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </Button>
          </Card>
        )}

        {/* 404 Not Found State */}
        {isNotFound && (
          <Card className="border-border/50 bg-card/40 p-8 text-center space-y-4">
            <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Submission Not Found</h2>
              <p className="text-sm text-muted-foreground">
                No submission exists with ID #{id}. It may have been deleted or the identifier is invalid.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </Button>
          </Card>
        )}

        {/* General Error State */}
        {isError && !isForbidden && !isNotFound && (
          <Card className="border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
            <ShieldAlert className="w-8 h-8 text-destructive mx-auto" />
            <p className="text-sm font-semibold text-destructive">Failed to load submission</p>
            <p className="text-xs text-muted-foreground">{error?.message || 'Please verify your network connection.'}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
              Try Again
            </Button>
          </Card>
        )}

        {/* Successful Submission View */}
        {!isLoading && !isError && submission && (
          <motion.div {...fadeSlideUp} className="space-y-6">
            
            {/* Overview Card */}
            <Card className="border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-4 border-b border-border/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                        Submission #{submission.id || submission.submission_id}
                      </span>
                      {submission.problem_difficulty && (
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {submission.problem_difficulty}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">
                      {submission.problem_title || `Problem #${submission.problem_id || 'N/A'}`}
                    </CardTitle>
                  </div>

                  <div className="flex items-center gap-3">
                    {getVerdictBadge(submission.verdict, submission.status)}
                    {submission.problem_id && (
                      <Button variant="outline" size="sm" asChild className="gap-1 text-xs">
                        <Link to={`/problems/${submission.problem_id}/solve`}>
                          <span>Solve</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-background/50 border border-border/40">
                    <span className="text-muted-foreground block mb-0.5">Language</span>
                    <span className="font-semibold text-foreground text-sm font-mono uppercase">
                      {submission.language || 'cpp'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-background/50 border border-border/40">
                    <span className="text-muted-foreground block mb-0.5">Execution Time</span>
                    <span className="font-semibold text-foreground text-sm font-mono">
                      {submission.execution_time_ms != null ? `${submission.execution_time_ms} ms` : '—'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-background/50 border border-border/40">
                    <span className="text-muted-foreground block mb-0.5">Status</span>
                    <span className="font-semibold text-foreground text-sm capitalize">
                      {submission.status || 'Finished'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-background/50 border border-border/40">
                    <span className="text-muted-foreground block mb-0.5">Submitted At</span>
                    <span className="font-medium text-foreground text-xs">
                      {submission.created_at ? new Date(submission.created_at).toLocaleString() : 'Recently'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Source Code Card */}
            <Card className="border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden">
              <CardHeader className="py-3 px-4 border-b border-border/40 bg-background/60 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Submitted Source Code (C++17)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyCode}
                  className="h-7 text-xs gap-1.5 px-2 hover:bg-white/10"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <pre className="p-4 bg-[#0a0a0f] text-neutral-200 text-xs font-mono overflow-x-auto leading-relaxed max-h-[600px] border-none select-text">
                  <code>{submission.source_code || '// No source code recorded'}</code>
                </pre>
              </CardContent>
            </Card>

          </motion.div>
        )}

      </Container>
    </PageWrapper>
  );
}

