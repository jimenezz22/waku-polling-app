import React, { useState } from 'react';
import { DataService, createPollDataWithDefaults } from '../services/DataService';
import { useIdentity } from '../hooks/useIdentity';
import { usePolls } from '../hooks/usePolls';

interface PollCreationProps {
  dataService: DataService;
  onPollCreated?: () => void;
}

export const PollCreation: React.FC<PollCreationProps> = ({
  dataService,
  onPollCreated
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { identity, fullPublicKey } = useIdentity();
  const { createPoll } = usePolls(dataService);

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const validateForm = (): string | null => {
    if (!question.trim()) {
      return 'Question is required';
    }

    if (question.trim().length < 5) {
      return 'Question must be at least 5 characters';
    }

    const validOptions = options.filter(opt => opt.trim().length > 0);
    if (validOptions.length < 2) {
      return 'At least 2 options are required';
    }

    const duplicates = new Set(validOptions.map(o => o.toLowerCase()));
    if (duplicates.size !== validOptions.length) {
      return 'Options must be unique';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setSuccess(false);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!identity || !fullPublicKey) {
      setError('Identity not available. Please refresh the page.');
      return;
    }

    if (!dataService.isReady()) {
      setError('Waku network not ready. Please wait...');
      return;
    }

    setIsSubmitting(true);

    try {
      const validOptions = options.filter(opt => opt.trim().length > 0);

      const pollData = createPollDataWithDefaults(
        question.trim(),
        validOptions.map(opt => opt.trim()),
        fullPublicKey
      );

      await createPoll(pollData);

      setSuccess(true);
      setQuestion('');
      setOptions(['', '']);
      setError(null);

      onPollCreated?.();

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to create poll:', err);
      setError(err instanceof Error ? err.message : 'Failed to create poll');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="poll-creation">
      <h2>Create a Poll</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="question">Question</label>
          <input
            id="question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What's your question?"
            disabled={isSubmitting}
            maxLength={200}
          />
          <small>{question.length}/200</small>
        </div>

        <div className="form-group">
          <label>Options</label>
          {options.map((option, index) => (
            <div key={index} className="option-input">
              <input
                type="text"
                value={option}
                onChange={(e) => updateOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                disabled={isSubmitting}
                maxLength={100}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  disabled={isSubmitting}
                  className="btn-remove"
                  title="Remove option"
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {options.length < 6 && (
            <button
              type="button"
              onClick={addOption}
              disabled={isSubmitting}
              className="btn-add-option"
            >
              + Add Option
            </button>
          )}
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            Poll created successfully!
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !dataService.isReady()}
          className="btn-primary"
        >
          {isSubmitting ? 'Creating Poll...' : 'Create Poll'}
        </button>
      </form>
    </div>
  );
};

export default PollCreation;