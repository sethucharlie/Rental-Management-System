"use client";

import { useEffect, useState, useMemo } from 'react';
import { errorMessage, landlordFetch } from '@/lib/landlord-api';
import type { LeaseState, TenantState } from '@/lib/lease/model';
import type { DashboardRow, SignatureView, TenantView } from '@/lib/lease/views';
import EditTenantModal, { TenantChanges } from '@/components/EditTenantModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import SignatureViewModal from '@/components/SignatureViewModal';
import { Search, Filter, Edit2, Trash2, ArrowUpDown, PenLine, Copy, Check, RefreshCw } from 'lucide-react';

type SortField = 'name' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const TENANT_STATE_LABEL: Record<TenantState, string> = { current: 'Current', moved_out: 'Moved Out' };
const LEASE_STATE_LABEL: Record<LeaseState, string> = {
  awaiting_signature: 'Awaiting Signature',
  signed: 'Signed',
  ended: 'Ended',
};

const rowKey = (row: DashboardRow) => row.tenant?.id ?? `lease-${row.lease?.id}`;

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

export default function TenantsPage() {
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantStateFilter, setTenantStateFilter] = useState('all');
  const [leaseStateFilter, setLeaseStateFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Modals
  const [editingTenant, setEditingTenant] = useState<TenantView | null>(null);
  const [deleting, setDeleting] = useState<DashboardRow | null>(null);
  const [signature, setSignature] = useState<{ tenantName: string; view: SignatureView } | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState('');

  // Bumping this reloads the list.
  const [reloads, setReloads] = useState(0);
  const reload = () => setReloads((n) => n + 1);

  useEffect(() => {
    let cancelled = false;
    landlordFetch<{ rows: DashboardRow[] }>('/api/tenants')
      .then(
        ({ rows }) => {
          if (cancelled) return;
          setRows(rows);
          setLoadError('');
        },
        (err) => !cancelled && setLoadError(errorMessage(err, 'Failed to load Tenants')),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [reloads]);

  const handleSaveTenant = async (tenantId: string, changes: TenantChanges) => {
    await landlordFetch(`/api/tenants/${encodeURIComponent(tenantId)}`, { method: 'PATCH', body: changes });
    reload();
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    const url = deleting.tenant
      ? `/api/tenants/${encodeURIComponent(deleting.tenant.id)}`
      : `/api/signing-links/${encodeURIComponent(deleting.lease!.id)}`;
    await landlordFetch(url, { method: 'DELETE' });
    setDeleting(null);
    reload();
  };

  const handleViewSignature = async (row: DashboardRow) => {
    try {
      const view = await landlordFetch<SignatureView>(`/api/leases/${encodeURIComponent(row.lease!.id)}/signature`);
      setSignature({ tenantName: row.tenant?.name ?? '', view });
    } catch (err) {
      alert(errorMessage(err, 'Failed to load the signature'));
    }
  };

  const copySigningLink = (leaseId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/lease/sign/${leaseId}`);
    setCopiedLinkId(leaseId);
    setTimeout(() => setCopiedLinkId(''), 2000);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(r => r.tenant?.name.toLowerCase().includes(lowerQuery));
    }

    if (tenantStateFilter === 'no_tenant') {
      result = result.filter(r => !r.tenant);
    } else if (tenantStateFilter !== 'all') {
      result = result.filter(r => r.tenant?.state === tenantStateFilter);
    }

    if (leaseStateFilter !== 'all') {
      result = result.filter(r => r.lease?.state === leaseStateFilter);
    }

    if (unitFilter !== 'all') {
      result = result.filter(r => r.lease?.unitType === unitFilter || r.lease?.unitNumber === unitFilter);
    }

    const sortValue = (r: DashboardRow) => (sortField === 'name' ? (r.tenant?.name ?? '') : (r.lease?.createdAt ?? ''));
    result.sort((a, b) => {
      const aVal = sortValue(a);
      const bVal = sortValue(b);
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, searchQuery, tenantStateFilter, leaseStateFilter, unitFilter, sortField, sortOrder]);

  const uniqueUnits = useMemo(() => {
    const units = new Set<string>();
    rows.forEach(r => {
      if (r.lease?.unitType) units.add(r.lease.unitType);
      if (r.lease?.unitNumber) units.add(r.lease.unitNumber);
    });
    return Array.from(units);
  }, [rows]);

  const getTenantStateBadge = (tenant: TenantView | null) => {
    if (!tenant) return <span className="text-xs text-gray-400">No Tenant yet</span>;
    return tenant.state === 'moved_out'
      ? <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs uppercase font-bold border border-yellow-200">Moved Out</span>
      : <span className="px-2 py-1 bg-green-100 text-green-800 text-xs uppercase font-bold border border-green-200">Current</span>;
  };

  const getLeaseStateBadge = (state?: LeaseState) => {
    switch (state) {
      case 'awaiting_signature':
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs uppercase font-bold border border-gray-200">Awaiting Signature</span>;
      case 'signed':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs uppercase font-bold border border-green-200">Signed</span>;
      case 'ended':
        return <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs uppercase font-bold border border-gray-300">Ended</span>;
      default:
        return <span className="text-xs text-gray-400">—</span>;
    }
  };

  const deletingName = deleting?.tenant
    ? deleting.tenant.name
    : `the Signing Link for ${[deleting?.lease?.unitType, deleting?.lease?.unitNumber].filter(Boolean).join(' ')}`;

  return (
    <div className="text-black font-sans selection:bg-black selection:text-white">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight mb-1">Tenant Management</h1>
          <p className="text-gray-500 text-sm">Each Tenant with their current Lease, and Signing Links nobody has signed yet.</p>
        </div>
        <div className="flex items-end gap-4">
          <div className="relative border-b-2 border-black flex items-center">
            <Search size={18} className="text-gray-400 absolute left-0" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pb-1 pr-2 w-full md:w-64 focus:outline-none bg-transparent text-sm"
            />
          </div>
          <button
            onClick={() => { setLoading(true); reload(); }}
            className="p-2 border border-gray-200 hover:border-black transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8 p-4 border border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          <select
            value={tenantStateFilter}
            onChange={(e) => setTenantStateFilter(e.target.value)}
            className="text-sm border-b border-black bg-transparent focus:outline-none pb-1 cursor-pointer"
          >
            <option value="all">All Tenants</option>
            {Object.entries(TENANT_STATE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
            <option value="no_tenant">No Tenant yet</option>
          </select>

          <select
            value={leaseStateFilter}
            onChange={(e) => setLeaseStateFilter(e.target.value)}
            className="text-sm border-b border-black bg-transparent focus:outline-none pb-1 cursor-pointer"
          >
            <option value="all">All Leases</option>
            {Object.entries(LEASE_STATE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="text-sm border-b border-black bg-transparent focus:outline-none pb-1 cursor-pointer"
          >
            <option value="all">All Units</option>
            {uniqueUnits.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        {loadError && (
          <div className="bg-red-50 text-red-600 p-4 border border-red-200 text-sm mb-8">{loadError}</div>
        )}

        {/* Table */}
        <div className="overflow-x-auto border-2 border-black">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-gray-50">
                <th className="p-4 font-bold text-sm uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2">Name <ArrowUpDown size={14} /></div>
                </th>
                <th className="p-4 font-bold text-sm uppercase">Phone</th>
                <th className="p-4 font-bold text-sm uppercase">Unit</th>
                <th className="p-4 font-bold text-sm uppercase">Rent</th>
                <th className="p-4 font-bold text-sm uppercase">Tenant</th>
                <th className="p-4 font-bold text-sm uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center gap-2">Lease <ArrowUpDown size={14} /></div>
                </th>
                <th className="p-4 font-bold text-sm uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">Loading tenants...</td>
                </tr>
              ) : filteredAndSortedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">No tenants found matching your criteria.</td>
                </tr>
              ) : (
                filteredAndSortedRows.map((row) => {
                  const { tenant, lease } = row;
                  const hasSignature = lease?.state === 'signed' || lease?.state === 'ended';
                  return (
                  <tr key={rowKey(row)} className="border-b border-gray-200 hover:bg-gray-50 transition-colors group">
                    <td className="p-4">
                      {tenant ? (
                        <>
                          <div className="font-medium">{tenant.name}</div>
                          {tenant.identityNumber && <div className="text-xs text-gray-500 mt-1">ID: {tenant.identityNumber}</div>}
                          {tenant.needsDepositAndParking && (
                            <div className="text-xs text-amber-700 mt-1">Deposit and parking not recorded</div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-gray-400">Signing Link sent</div>
                      )}
                    </td>
                    <td className="p-4 text-sm">{tenant?.phone}</td>
                    <td className="p-4 text-sm">
                      {[lease?.unitType, lease?.unitNumber].filter(Boolean).join(' - ') || '—'}
                    </td>
                    <td className="p-4 text-sm font-medium">{lease?.rent ? `R${lease.rent}` : '—'}</td>
                    <td className="p-4 text-sm">{getTenantStateBadge(tenant)}</td>
                    <td className="p-4 text-sm">
                      {getLeaseStateBadge(lease?.state)}
                      {lease?.endDate && <div className="text-xs text-gray-500 mt-2">Ends {formatDate(lease.endDate)}</div>}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {tenant && (
                          <button
                            onClick={() => setEditingTenant(tenant)}
                            className="p-2 border border-gray-200 hover:border-black hover:bg-black hover:text-white transition-colors"
                            title="Edit Tenant"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {hasSignature && (
                          <button
                            onClick={() => handleViewSignature(row)}
                            className="p-2 border border-gray-200 hover:border-black hover:bg-black hover:text-white transition-colors"
                            title="View Signature"
                          >
                            <PenLine size={16} />
                          </button>
                        )}
                        {!tenant && lease && (
                          <button
                            onClick={() => copySigningLink(lease.id)}
                            className="p-2 border border-gray-200 hover:border-black hover:bg-black hover:text-white transition-colors"
                            title="Copy Signing Link"
                          >
                            {copiedLinkId === lease.id ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleting(row)}
                          className="p-2 border border-gray-200 text-red-600 hover:border-red-600 hover:bg-red-600 hover:text-white transition-colors"
                          title={tenant ? 'Delete Tenant' : 'Delete Signing Link'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      <EditTenantModal
        key={editingTenant?.id}
        isOpen={editingTenant !== null}
        onClose={() => setEditingTenant(null)}
        tenant={editingTenant}
        onSave={handleSaveTenant}
      />

      <ConfirmDeleteModal
        isOpen={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
        tenantName={deletingName}
        detail={deleting?.tenant ? 'This also deletes all their Leases and signatures, and cannot be undone.' : 'The link will stop working. This cannot be undone.'}
      />

      <SignatureViewModal
        isOpen={signature !== null}
        onClose={() => setSignature(null)}
        tenantName={signature?.tenantName}
        signatureBase64={signature?.view.image}
        signatureDate={signature?.view.dateSigned}
        signatureName={signature?.view.printedName}
      />
    </div>
  );
}
