import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Create a new blank tenant document
    const docRef = await addDoc(collection(db, 'tenants'), {
      ...body,
      isSigned: false,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Generate the unique link
    // Assuming the client will construct the full URL
    const link = `/lease/sign/${docRef.id}`;

    return NextResponse.json({ 
      success: true, 
      id: docRef.id, 
      link 
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating link:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create link' }, 
      { status: 500 }
    );
  }
}
