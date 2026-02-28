import React from 'react';
import { cn } from '@hireflow/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> { }

export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-[var(--color-outline)] opacity-50", className)}
            {...props}
        />
    );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
    return (
        <tr className="hover:bg-transparent">
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} className="py-4">
                    <Skeleton className="h-4 w-[80%]" />
                </td>
            ))}
        </tr>
    );
}

export function InterviewTableSkeleton() {
    return (
        <>
            <TableRowSkeleton columns={7} />
            <TableRowSkeleton columns={7} />
            <TableRowSkeleton columns={7} />
            <TableRowSkeleton columns={7} />
            <TableRowSkeleton columns={7} />
        </>
    );
}
