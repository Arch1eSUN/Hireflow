import type { ApiResponse } from '@hireflow/types';

export function success<T>(data: T, meta?: ApiResponse<T>['meta']): ApiResponse<T> {
    return { success: true, data, meta };
}

export function error(code: string, message: string): ApiResponse<never> {
    return { success: false, error: { code, message } };
}
