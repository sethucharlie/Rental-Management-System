"use client";

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, QuerySnapshot, DocumentData, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Tenant } from '@/types';
import EditTenantModal from '@/components/EditTenantModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import SignatureViewModal from '@/components/SignatureViewModal';
import { Search, Filter, Edit2, Trash2, Archive, CheckCircle, XCircle, ArrowUpDown, PenLine } from 'lucide-react';

type SortField = 'name' | 'createdAt' | 'moveOutDate';
type SortOrder = 'asc' | 'desc';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'tenants'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const tenantData: Tenant[] = [];
      snapshot.forEach((doc) => {
        tenantData.push({ id: doc.id, ...doc.data() } as Tenant);
      });
      setTenants(tenantData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setEditModalOpen(true);
  };

  const handleDeleteClick = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDeleteModalOpen(true);
  };

  const handleSaveTenant = async (tenantId: string, data: Partial<Tenant>) => {
    const tenantRef = doc(db, 'tenants', tenantId);
    await updateDoc(tenantRef, { ...data, updatedAt: serverTimestamp() });
  };

  const handleConfirmDelete = async () => {
    if (!selectedTenant) return;
    const tenantRef = doc(db, 'tenants', selectedTenant.id);
    await deleteDoc(tenantRef);
    setDeleteModalOpen(false);
    setSelectedTenant(null);
  };

  const handleArchive = async (tenantId: string) => {
    try {
      await handleSaveTenant(tenantId, { status: 'archived' });
    } catch (err) {
      console.error(err);
      alert('Failed to archive tenant');
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedTenants = useMemo(() => {
    let result = [...tenants];

    // Exclude archived by default unless filtering explicitly
    if (statusFilter !== 'archived') {
      result = result.filter(t => t.status !== 'archived');
    }

    // Filter by search query (name)
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(t => t.name?.toLowerCase().includes(lowerQuery));
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(t => (t.status || 'active') === statusFilter);
    }

    // Filter by unit
    if (unitFilter !== 'all') {
      result = result.filter(t => t.unitType === unitFilter || t.unitNumber === unitFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle timestamps
      if (sortField === 'createdAt' || sortField === 'moveOutDate') {
        aVal = aVal?.seconds ? aVal.seconds : 0;
        bVal = bVal?.seconds ? bVal.seconds : 0;
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [tenants, searchQuery, statusFilter, unitFilter, sortField, sortOrder]);

  const uniqueUnits = useMemo(() => {
    const units = new Set<string>();
    tenants.forEach(t => {
      if (t.unitType) units.add(t.unitType);
      if (t.unitNumber) units.add(t.unitNumber);
    });
    return Array.from(units);
  }, [tenants]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'moved_out':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs uppercase font-bold border border-yellow-200">Moved Out</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs uppercase font-bold border border-gray-200">Pending</span>;
      case 'eviction_notice':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs uppercase font-bold border border-red-200">Eviction Notice</span>;
      case 'archived':
        return <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs uppercase font-bold border border-gray-300">Archived</span>;
      case 'active':
      default:
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs uppercase font-bold border border-green-200">Active</span>;
    }
  };

  return (
    <div className="text-black font-sans selection:bg-black selection:text-white">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight mb-1">Tenant Management</h1>
          <p className="text-gray-500 text-sm">View, edit, and manage all your tenants in real-time.</p>
        </div>
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
      </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8 p-4 border border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>
          
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border-b border-black bg-transparent focus:outline-none pb-1 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="moved_out">Moved Out</option>
            <option value="pending">Pending</option>
            <option value="archived">Archived</option>
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
                <th className="p-4 font-bold text-sm uppercase">Status</th>
                <th className="p-4 font-bold text-sm uppercase">Signed</th>
                <th className="p-4 font-bold text-sm uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">Loading tenants...</td>
                </tr>
              ) : filteredAndSortedTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">No tenants found matching your criteria.</td>
                </tr>
              ) : (
                filteredAndSortedTenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors group">
                    <td className="p-4">
                      <div className="font-medium">{tenant.name}</div>
                      {tenant.idNumber && <div className="text-xs text-gray-500 mt-1">ID: {tenant.idNumber}</div>}
                    </td>
                    <td className="p-4 text-sm">{tenant.phone}</td>
                    <td className="p-4 text-sm">
                      {[tenant.unitType, tenant.unitNumber].filter(Boolean).join(' - ') || '—'}
                    </td>
                    <td className="p-4 text-sm font-medium">{tenant.rent ? `R${tenant.rent}` : '—'}</td>
                    <td className="p-4 text-sm">{getStatusBadge(tenant.status)}</td>
                    <td className="p-4">
                      {tenant.isSigned ? (
                        <button
                          onClick={() => { setSelectedTenant(tenant); setSignatureModalOpen(true); }}
                          title="View Signature"
                          className="text-green-600 hover:text-green-800 transition-colors"
                        >
                          <CheckCircle size={18} />
                        </button>
                      ) : (
                        <XCircle size={18} className="text-red-600" />
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(tenant)}
                          className="p-2 border border-gray-200 hover:border-black hover:bg-black hover:text-white transition-colors"
                          title="Edit Tenant"
                        >
                          <Edit2 size={16} />
                        </button>
                        {tenant.isSigned && (
                          <button
                            onClick={() => { setSelectedTenant(tenant); setSignatureModalOpen(true); }}
                            className="p-2 border border-gray-200 hover:border-black hover:bg-black hover:text-white transition-colors"
                            title="View Signature"
                          >
                            <PenLine size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleArchive(tenant.id)}
                          className="p-2 border border-gray-200 hover:border-black hover:bg-gray-200 transition-colors"
                          title="Archive Tenant"
                        >
                          <Archive size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(tenant)}
                          className="p-2 border border-gray-200 text-red-600 hover:border-red-600 hover:bg-red-600 hover:text-white transition-colors"
                          title="Delete Tenant"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      <EditTenantModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        tenant={selectedTenant}
        onSave={handleSaveTenant}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        tenantName={selectedTenant?.name || ''}
      />

      <SignatureViewModal
        isOpen={signatureModalOpen}
        onClose={() => { setSignatureModalOpen(false); setSelectedTenant(null); }}
        tenantName={selectedTenant?.name}
        signatureBase64={selectedTenant?.signatureBase64}
        signatureDate={(selectedTenant as any)?.signatureDate}
        signatureName={(selectedTenant as any)?.signatureName}
      />
    </div>
  );
}
