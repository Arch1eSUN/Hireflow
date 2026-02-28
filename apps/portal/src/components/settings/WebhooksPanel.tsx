import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Webhook, Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/stores/authStore';

interface WebhookEndpoint {
    id: string;
    url: string;
    secret?: string;
    isActive: boolean;
    events: string[];
    createdAt: string;
}

export const WebhooksPanel: React.FC = () => {
    const queryClient = useQueryClient();
    const currentRole = useAuthStore((state) => state.user?.role);
    const canManageSecrets = currentRole === 'owner' || currentRole === 'admin';
    const [isCreating, setIsCreating] = useState(false);
    const [newUrl, setNewUrl] = useState('');
    const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const { data: endpoints = [], isLoading } = useQuery<WebhookEndpoint[]>({
        queryKey: ['webhooks'],
        queryFn: async () => {
            const res = await api.get<{ data: WebhookEndpoint[] }>('/webhooks');
            return res.data.data;
        },
        enabled: canManageSecrets,
    });

    const createWebhookMutation = useMutation({
        mutationFn: async (url: string) => {
            const res = await api.post('/webhooks', { url, events: ['interview.completed'] });
            return res.data;
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['webhooks'] });
            setGeneratedSecret(res.data.secret);
            setIsCreating(false);
            setNewUrl('');
            toast.success('Webhook created successfully');
        },
        onError: () => toast.error('Failed to create Webhook'),
    });

    const deleteWebhookMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/webhooks/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['webhooks'] });
            toast.success('Webhook deleted');
        },
        onError: () => toast.error('Failed to delete webhook'),
    });

    const handleCopy = () => {
        if (generatedSecret) {
            navigator.clipboard.writeText(generatedSecret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success('Copied to clipboard');
        }
    };

    if (!canManageSecrets) return null;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Webhooks</h2>
                    <p className="text-sm text-gray-500">Subscribe to events like interview completion via HTTP POST.</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Endpoint
                </button>
            </div>

            {isCreating && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">New Webhook Endpoint</h3>
                    <div className="flex gap-4">
                        <input
                            type="url"
                            value={newUrl}
                            onChange={(e) => setNewUrl(e.target.value)}
                            placeholder="https://your-ats.com/webhook/receive"
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-transparent text-gray-900 dark:text-gray-100"
                            autoFocus
                        />
                        <button
                            onClick={() => {
                                if (!newUrl.trim() || !newUrl.startsWith('http')) {
                                    toast.error('Must be a valid HTTP/HTTPS URL');
                                    return;
                                }
                                createWebhookMutation.mutate(newUrl);
                            }}
                            disabled={createWebhookMutation.isPending || !newUrl.trim()}
                            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 text-sm font-medium disabled:opacity-50"
                        >
                            {createWebhookMutation.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            onClick={() => {
                                setIsCreating(false);
                                setNewUrl('');
                            }}
                            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-sm font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {generatedSecret && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-xl border border-amber-200 dark:border-amber-800/30">
                    <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">Webhook Signing Secret</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
                        Use this HMAC SHA256 secret to verify the `X-Hireflow-Signature` header of incoming webhook requests. It will only be shown once.
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white dark:bg-gray-900 px-4 py-3 rounded border border-gray-200 dark:border-gray-700 font-mono text-sm text-gray-900 dark:text-gray-100 select-all">
                            {generatedSecret}
                        </code>
                        <button
                            onClick={handleCopy}
                            className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded transition-colors"
                        >
                            {copied ? <Check className="w-5 h-5 text-amber-500" /> : <Copy className="w-5 h-5" />}
                        </button>
                    </div>
                    <button
                        onClick={() => setGeneratedSecret(null)}
                        className="mt-4 px-4 py-2 bg-amber-100 text-amber-800 dark:bg-amber-800/40 dark:text-amber-300 rounded-md text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-800/60"
                    >
                        I've saved it securely
                    </button>
                </div>
            )}

            <div className="space-y-4">
                {isLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : endpoints.length === 0 ? (
                    <EmptyState
                        icon={Webhook}
                        title="No Webhook Endpoints"
                        subtitle="Configure a webhook URL to receive real-time updates when interviews finish."
                    />
                ) : (
                    endpoints.map((endpoint) => (
                        <div
                            key={endpoint.id}
                            className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shrink-0"
                        >
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100">{endpoint.url}</h4>
                                    <span className={`px-2 py-0.5 rounded text-xs ${endpoint.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                                        {endpoint.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                    Subscribed events: {endpoint.events.join(', ')}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm('Are you sure you want to delete this endpoint?')) {
                                        deleteWebhookMutation.mutate(endpoint.id);
                                    }
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Delete Endpoint"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
