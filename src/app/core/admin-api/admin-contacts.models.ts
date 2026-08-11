export interface ContactSearchRequest {
  email?: string;
  fromDate?: string;
  toDate?: string;
}

export interface CreateContactMessageRequest {
  name?: string;
  email: string;
  subject?: string;
  message: string;
  phoneNumber?: string;
  privacyPolicyAccepted: boolean;
  website: string;
}

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
  phoneNumber: string;
  submittedAt: string;
}
