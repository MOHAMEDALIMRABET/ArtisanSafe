// Types pour le système de traduction

export type Language = 'fr' | 'en';

export interface Translations {
  common: {
    welcome: string;
    loading: string;
    error: string;
    success: string;
    cancel: string;
    confirm: string;
    save: string;
    delete: string;
    edit: string;
    search: string;
    filter: string;
    close: string;
    next: string;
    previous: string;
    send: string;
    email: string;
    password: string;
    phone: string;
    address: string;
  };
  nav: {
    home: string;
    directory: string;
    howItWorks: string;
    contact: string;
    login: string;
    signup: string;
    logout: string;
    dashboard: string;
    profile: string;
    messages: string;
    notifications: string;
    settings: string;
    beCalledBack: string;
    expressWorks: string;
    expressRequests: string;
  };
  auth: {
    signIn: string;
    signUp: string;
    forgotPassword: string;
    rememberMe: string;
    noAccount: string;
    hasAccount: string;
    continueWith: string;
    client: string;
    artisan: string;
    admin: string;
    adminAccess: string;
    emailError: string;
    passwordError: string;
    loginError: string;
    accountCreated: string;
    emailVerification: string;
    emailVerified: string;
  };
  userMenu: {
    myProfile: string;
    myQuotes: string;
    myRequests: string;
    myMessages: string;
    myReviews: string;
    myContracts: string;
    myAvailability: string;
    settings: string;
    help: string;
    logout: string;
    verifiedProfile: string;
  };
  roles: {
    client: string;
    artisan: string;
    admin: string;
  };
  trades: {
    plumbing: string;
    electricity: string;
    carpentry: string;
    masonry: string;
    painting: string;
    roofing: string;
    locksmith: string;
    glazing: string;
  };
  notifications: {
    title: string;
    markAllRead: string;
    noNotifications: string;
    newQuote: string;
    quoteAccepted: string;
    quoteRejected: string;
    newMessage: string;
    newRequest: string;
  };
  footer: {
    about: string;
    terms: string;
    privacy: string;
    contact: string;
    followUs: string;
    allRightsReserved: string;
  };
}
