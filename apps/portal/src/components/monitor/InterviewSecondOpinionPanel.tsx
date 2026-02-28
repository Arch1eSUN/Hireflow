import React from 'react';
import { BrainCircuit } from 'lucide-react';
import { UseMutationResult } from '@tanstack/react-query';
import { cn } from '@hireflow/utils';

export interface InterviewSecondOpinionPanelProps {
    interview: any; // We can type this better later
    secondOpinionMutation: UseMutationResult<any, any, void, unknown>;
}

export const InterviewSecondOpinionPanel: React.FC<InterviewSecondOpinionPanelProps> = ({
    interview,
    secondOpinionMutation
}) => {
    if (interview?.status !== 'completed') {
        return null;
    }

    return (
        <div className="p-3 bg-[var(--color-surface-dim)] rounded border border-[var(--color-outline)]">
            <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-medium uppercase text-[var(--color-text-secondary)] flex items-center gap-1.5">
                    <BrainCircuit size={12} /> AI Second Opinion
                </div>
            </div>
            {interview.secondOpinion ? (
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[11px] text-[var(--color-text-secondary)]">Recommendation</span>
                        <span className={cn(
                            'text-xs font-bold uppercase',
                            interview.secondOpinion.recommendation === 'strong_hire' || interview.secondOpinion.recommendation === 'hire'
                                ? 'text-[var(--color-success)]'
                                : interview.secondOpinion.recommendation === 'maybe'
                                    ? 'text-[var(--color-warning)]'
                                    : 'text-[var(--color-error)]'
                        )}>
                            {String(interview.secondOpinion.recommendation).replace('_', ' ')}
                        </span>
                    </div>
                    <div className="text-[11px] text-[var(--color-text-primary)] border-l-2 border-[var(--color-outline)] pl-2 py-1">
                        {interview.secondOpinion.summary}
                    </div>
                    <button
                        className="btn w-full h-8 text-[11px] border border-[var(--color-outline)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]"
                        onClick={() => secondOpinionMutation.mutate()}
                        disabled={secondOpinionMutation.isPending}
                    >
                        {secondOpinionMutation.isPending ? 'Regenerating...' : 'Regenerate Opinion'}
                    </button>
                </div>
            ) : (
                <div className="text-center">
                    <div className="text-[11px] text-[var(--color-text-secondary)] mb-2 mt-1">
                        No secondary AI evaluation requested yet. Use this to reduce bias and get an objective second look.
                    </div>
                    <button
                        className="btn btn-filled w-full h-8 text-[11px]"
                        onClick={() => secondOpinionMutation.mutate()}
                        disabled={secondOpinionMutation.isPending}
                    >
                        {secondOpinionMutation.isPending ? 'Requesting...' : 'Request Second Opinion'}
                    </button>
                </div>
            )}
        </div>
    );
};
