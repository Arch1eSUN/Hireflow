import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Key, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/stores/authStore';

interface DeveloperApiKey {
    id: string;
    name: string;
    prefix: string;
    lastUsedAt: string | null;
    createdAt: string;
}

export const ApiKeysPanel: React.FC = () => {
    const queryClient = useQueryClient();
    const currentRole = useAuthStore((state) => state.user?.role);
    const canManageSecrets = currentRole === 'owner' || currentRole === 'admin';
    const [isCreating, setIsCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const { data: keys = [], isLoading } = useQuery<DeveloperApiKey[]>({
        queryKey: ['developer-api-keys'],
        queryFn: async () => {
            const res = await api.get<{ data: DeveloperApiKey[] }>('/api-keys');
            return res.data.data;
        },
        enabled: canManageSecrets,
    });

    const createKeyMutation = useMutation({
        mutationFn: async (name: string) => {
            const res = await api.post('/api-keys', { name });
            return res.data;
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['developer-api-keys'] });
            setGeneratedKey(res.data.apiKey);
            setIsCreating(false);
            setNewKeyName('');
            toast.success('API Key generated successfully');
        },
        onError: () => toast.error('Failed to generate API Key'),
    });

    const deleteKeyMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/api-keys/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['developer-api-keys'] });
            toast.success('API Key revoked');
        },
        onError: () => toast.error('Failed to revoke API Key'),
    });

    const handleCopy = () => {
        if (generatedKey) {
            navigator.clipboard.writeText(generatedKey);
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
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">API Keys</h2>
                    <p className="text-sm text-gray-500">Manage API keys to access Hireflow REST API.</p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Create Key
                </button>
            </div>

            {isCreating && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">Create New API Key</h3>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            placeholder="e.g. ATS Integration Key"
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-transparent text-gray-900 dark:text-gray-100"
                            autoFocus
                        />
                        <button
                            onClick={() => {
                                if (!newKeyName.trim()) return;
                                createKeyMutation.mutate(newKeyName);
                            }}
                            disabled={createKeyMutation.isPending || !newKeyName.trim()}
                            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 text-sm font-medium disabled:opacity-50"
                        >
                            {createKeyMutation.isPending ? 'Generating...' : 'Generate'}
                        </button>
                        <button
                            onClick={() => {
                                setIsCreating(false);
                                setNewKeyName('');
                            }}
                            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-sm font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {generatedKey && (
                <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800/30">
                    <h3 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">Save your new API key!</h3>
                    <p className="text-sm text-green-700 dark:text-green-400 mb-4">
                        We will only show this key once. Make sure to copy it now.
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white dark:bg-gray-900 px-4 py-3 rounded border border-gray-200 dark:border-gray-700 font-mono text-sm text-gray-900 dark:text-gray-100 select-all">
                            {generatedKey}
                        </code>
                        <button
                            onClick={handleCopy}
                            className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded transition-colors"
                        >
                            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                        </button>
                    </div>
                    <button
                        onClick={() => setGeneratedKey(null)}
                        className="mt-4 px-4 py-2 bg-green-100 text-green-800 dark:bg-green-800/40 dark:text-green-300 rounded-md text-sm font-medium hover:bg-green-200 dark:hover:bg-green-800/60"
                    >
                        I've saved it securely
                    </button>
                </div>
            )}

            <div className="space-y-4">
                {isLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : keys.length === 0 ? (
                    <EmptyState
                        icon={Key}
                        title="No API Keys"
                        subtitle="Create an API key to allow external systems to access Hireflow REST APIs."
                    />
                ) : (
                    keys.map((key) => (
                        <div
                            key={key.id}
                            className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shrink-0"
                        >
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100">{key.name}</h4>
                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
                                        {key.prefix}•••••
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                    Created {new Date(key.createdAt).toLocaleDateString()}
                                    {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
                                        deleteKeyMutation.mutate(key.id);
                                    }
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Revoke Key"
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
