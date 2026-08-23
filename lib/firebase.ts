/**
 * Mock Firebase implementation to bypass Google limitations.
 */
export const db = {} as any;
export const auth = {
  currentUser: null,
  onAuthStateChanged: (cb: any) => {
      // Mock bypass check based on local storage
      const bypass = localStorage.getItem('educational_map_bypass_secret');
      if (bypass === '1068575628') {
          cb({ uid: 'admin-local', email: 'aborakan8885@gmail.com', displayName: 'مدير النظام' });
      } else {
          const user = localStorage.getItem('educational_map_current_user');
          if (user) cb(JSON.parse(user));
          else cb(null);
      }
      return () => {};
  },
  signOut: async () => {
      localStorage.removeItem('educational_map_bypass_secret');
      localStorage.removeItem('educational_map_current_user');
      window.location.reload();
  }
} as any;

export default {};
