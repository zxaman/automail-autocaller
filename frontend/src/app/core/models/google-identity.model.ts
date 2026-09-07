/** Minimal typings for the Google Identity Services browser library. */
export interface GoogleCredentialResponse {
  readonly credential: string;
  readonly select_by?: string;
}

export interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'small' | 'medium' | 'large';
      text?: 'signin_with' | 'signup_with' | 'continue_with';
      shape?: 'rectangular' | 'pill';
      logo_alignment?: 'left' | 'center';
      width?: number;
    },
  ): void;
  disableAutoSelect(): void;
}

export interface GoogleNamespace {
  readonly accounts: {
    readonly id: GoogleAccountsId;
  };
}

declare global {
  // eslint-disable-next-line no-var
  var google: GoogleNamespace | undefined;
}
