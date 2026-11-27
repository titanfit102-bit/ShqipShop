import {MEDUSA_BACKEND_URL, PUBLISHABLE_API_KEY} from '@env';
import {createStoreHttpClient} from './store-http-client';
export {AUTH_TOKEN_KEY} from './auth-token-storage';

export const apiUrl = MEDUSA_BACKEND_URL || 'http://localhost:9000';

export default createStoreHttpClient(apiUrl, PUBLISHABLE_API_KEY || '');
