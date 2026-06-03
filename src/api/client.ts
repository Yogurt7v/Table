import PocketBase from 'pocketbase';

const API_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:8090'
  : window.location.origin;

export const pb = new PocketBase(API_URL);
