// types.ts
export type RootStackParamList = {
  Intro: undefined;
  Login: undefined; // no params
  NotificationSettings: undefined; // no params
  Signup: undefined; // ✅ Add this line
  Earn: undefined;
  OtpVerification: undefined;
  ForgotPassword: undefined;
  ResetOtp: { email: string }; // 👈 include this
  Dashboard: undefined;
  Notifications: undefined;
  Profile: undefined;
  GetTag: { serviceName: string };
  Calculator: { serviceName: string };
  PasscodeUnlock: undefined;
  SetPasscode: undefined;
  History: undefined;
  TradeConfirmation: { serviceName: string };
  MyPreSubmissions: undefined;
  ImagePreview: { url: string };
  Withdrawal: undefined;
  SendBank: undefined;
  SendExdollarium: undefined;
  BankTransferForm: { recipient: string };
  NewBankRecipient: undefined;
  AddBankScreen: undefined;
  SendViaBankScreen: undefined;
  // OTP is optional: screen supports fresh set (no otp) or otp-based reset
  SetPINScreen: { otp?: string };
  SuccessScreen: { message: string; receiptData?: ReceiptData };
  WithdrawalSuccess: { receiptData?: any; message?: string; status?: string; providerReference?: string };
  SendSuccess: { receiptData?: any; message: string; status?: string }; // ✅ add this
  WithdrawalFormScreen: {
    selectedBank: BankAccount;
  };
  Receipt: {
    receiptData: ReceiptData;
  };
  Help: undefined;
  Messages: undefined;
  Tickets: undefined;
  Chat: { ticketId?: string; ticketSubject?: string; initialMessages?: Array<{ id: string; text: string; from: 'user' | 'bot' | string }> } | undefined;
  DevAuthDebug?: undefined;
  ResetPinScreen: undefined;
  VerifyPinOtpScreen: undefined;
  SuccessOnboarding: undefined;
};
export type BankAccount = {
  id?: string;
  _id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string;
};
export type ReceiptField = {
  label: string;
  value: string;
  copyable?: boolean;
};

export type ReceiptData = {
  title: string;
  fields: ReceiptField[];
  transactionRef?: string;
  date?: string;
  header?: {
    brand?: string;
    title?: string;
    logoUri?: string;
  };
};
