import { createDefaultShareHandler } from './_lib/createShareHandler.js';

// Vercel serverless entry for the public SOP links. All logic lives in api/_lib so the local Express dev server
// (server/index.js) runs exactly the same code.
export default createDefaultShareHandler();
