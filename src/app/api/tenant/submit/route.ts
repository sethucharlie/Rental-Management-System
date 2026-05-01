import { NextResponse } from 'next/server';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, signatureBase64, name, phone, idNumber, unit, rent, ...otherData } = body;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Missing tenantId' }, { status: 400 });
    }

    let signatureUrl = '';

    // If a signature image was provided, upload it to Firebase Storage
    if (signatureBase64) {
      const timestamp = Date.now();
      const signatureRef = ref(storage, `signatures/${tenantId}-${timestamp}.png`);
      
      // Upload the base64 string
      await uploadString(signatureRef, signatureBase64, 'data_url');
      
      // Get the public download URL
      signatureUrl = await getDownloadURL(signatureRef);
    }

    const updateData: any = {
      ...otherData,
      isSigned: true,
      signatureUrl,
      submittedAt: serverTimestamp(),
      status: "active", // Change status to active after signing
    };

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (idNumber !== undefined) updateData.idNumber = idNumber;
    if (unit !== undefined) updateData.unit = unit;
    if (rent !== undefined) updateData.rent = rent;

    // Update the tenant document with the submission data
    const tenantRef = doc(db, 'tenants', tenantId);
    await updateDoc(tenantRef, updateData);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error submitting tenant data:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to submit tenant data' }, 
      { status: 500 }
    );
  }
}
