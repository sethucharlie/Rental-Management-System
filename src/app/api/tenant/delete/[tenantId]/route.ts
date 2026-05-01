import { NextResponse } from 'next/server';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

export async function DELETE(
  request: Request,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;
    
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant ID is required' }, { status: 400 });
    }

    const tenantRef = doc(db, 'tenants', tenantId);
    const tenantSnap = await getDoc(tenantRef);

    if (!tenantSnap.exists()) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const tenantData = tenantSnap.data();

    // If there is a signature URL, attempt to delete it from Storage
    if (tenantData.signatureUrl) {
      try {
        // ref() can parse the download URL
        const signatureRef = ref(storage, tenantData.signatureUrl);
        await deleteObject(signatureRef);
      } catch (storageError) {
        console.error('Error deleting signature from storage:', storageError);
        // We log the error but still proceed to delete the Firestore document
      }
    }

    // Delete the Firestore document
    await deleteDoc(tenantRef);

    return NextResponse.json({ success: true, id: tenantId }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting tenant:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete tenant' }, 
      { status: 500 }
    );
  }
}
