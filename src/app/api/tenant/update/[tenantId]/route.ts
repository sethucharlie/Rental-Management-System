import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export async function PATCH(
  request: Request,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;
    
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID is required' }, { status: 400 });
    }

    const body = await request.json();
    
    // Ensure we don't accidentally overwrite the ID or other restricted fields if passed
    const { id, isSigned, createdAt, ...updateData } = body;

    const tenantRef = doc(db, 'tenants', tenantId);

    // If status is moved_out, and moveOutDate is not explicitly provided, we could set it
    // But usually the client will provide moveOutDate if needed, or we just trust the client payload.
    // We add serverTimestamp to updatedAt.
    await updateDoc(tenantRef, {
      ...updateData,
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: tenantId }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating tenant:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update tenant' }, 
      { status: 500 }
    );
  }
}
