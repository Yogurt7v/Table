import PocketBase from 'pocketbase';

const API_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:8090'
  : window.location.origin;

export const pb = new PocketBase(API_URL);

pb.afterSend = (response, data) => {
  if (response.status === 401 && pb.authStore.token) {
    pb.authStore.clear();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }
  return data;
};
