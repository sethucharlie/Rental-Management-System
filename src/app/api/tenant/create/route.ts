import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Create a new tenant document in the 'tenants' collection
    const docRef = await addDoc(collection(db, 'tenants'), {
      ...body,
      isSigned: false,
      status: "active",
      moveOutDate: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Generate the unique link
    const link = `/lease/sign/${docRef.id}`;

    return NextResponse.json({ 
      success: true, 
      id: docRef.id, 
      link 
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating tenant:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create tenant' }, 
      { status: 500 }
    );
  }
}
