export interface LoginPageState {
  readonly submitting: boolean;
  readonly errorMessage: string | null;
}

export interface GoogleCredentialPayload {
  readonly idToken: string;
}
