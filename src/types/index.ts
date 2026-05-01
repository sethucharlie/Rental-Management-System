export interface Tenant {
  id: string;
  name?: string;
  phone?: string;
  unitType: string;
  unitNumber: string;
  rent: string | number;
  idNumber?: string;
  status?: "active" | "moved_out" | "pending" | "eviction_notice" | "archived";
  isSigned: boolean;
  moveOutDate?: string | null;
  signatureBase64?: string;
  createdAt: any;
  updatedAt?: any;
  submittedAt?: any;
}
