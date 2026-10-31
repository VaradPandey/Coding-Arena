import React from 'react';
import { Select } from '@/components/ui/Forms';

export const LanguageSelector = ({ value = 'cpp', onChange, className }) => {
  const languageOptions = [
    { label: "C++17 (GCC 11.2) - Supported", value: "cpp" },
    { label: "Python 3.9 (Coming soon)", value: "python", disabled: true },
    { label: "Java 17 (Coming soon)", value: "java", disabled: true },
    { label: "JavaScript / Node (Coming soon)", value: "javascript", disabled: true },
  ];

  return (
    <Select
      value="cpp"
      onChange={(selected) => {
        // Only cpp is supported; reject or ignore any non-cpp value
        if (selected === 'cpp' && onChange) {
          onChange('cpp');
        }
      }}
      options={languageOptions}
      className={className}
      placeholder="Select Language"
    />
  );
};
