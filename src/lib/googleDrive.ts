const CLIENT_ID = '530335058228-4v7t7o8tvn7r86239t1851fhi0urfnn2.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile';

let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;

export const googleDrive = {
  async init(onAuthenticated: (token: string) => void, onError?: (error: any) => void) {
    return new Promise<void>(async (resolve) => {
      // Wait for scripts to load
      const waitForGlobal = (key: string) => {
        return new Promise<void>((resolve) => {
          // @ts-ignore
          if (window[key]) return resolve();
          const interval = setInterval(() => {
            // @ts-ignore
            if (window[key]) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        });
      };

      await Promise.all([waitForGlobal('gapi'), waitForGlobal('google')]);

      const checkInited = () => {
        if (gapiInited && gisInited) {
          resolve();
        }
      };

      // @ts-ignore
      gapi.load('client', async () => {
        try {
          // @ts-ignore
          await gapi.client.init({});
          // Explicitly load Drive API v3
          // @ts-ignore
          await gapi.client.load('drive', 'v3');
        } catch (e) {
          console.warn('[GoogleDrive] Primary load failed, trying fallback details', e);
        }

        // Verify if API actually loaded (cleardot/network issues can sometimes yield false positives)
        // @ts-ignore
        if (!gapi.client.drive) {
          console.log('[GoogleDrive] Drive API missing after load. Attempting discovery fallback...');
          try {
            // @ts-ignore
            await gapi.client.init({
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
          } catch (e2) {
            console.error('[GoogleDrive] Fallback discovery failed', e2);
          }
        }

        // Final check before marking as ready
        // @ts-ignore
        if (gapi.client.drive) {
          gapiInited = true;
          checkInited();
        } else {
          console.error('[GoogleDrive] CRITICAL: Failed to load Google Drive API.');
        }
      });

      // @ts-ignore
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error !== undefined) {
            if (onError) onError(response);
            else throw response;
            return;
          }
          onAuthenticated(response.access_token);
        },
      });
      gisInited = true;
      checkInited();
    });
  },

  async authenticate(prompt: 'consent' | 'select_account' | 'none' = 'select_account') {
    if (!tokenClient) return;
    tokenClient.requestAccessToken({ prompt });
  },

  async authenticateSilent() {
    return this.authenticate('none');
  },

  async setToken(token: string) {
    // @ts-ignore
    gapi.client.setToken({ access_token: token });
  },

  async signOut() {
    // @ts-ignore
    const token = gapi.client.getToken();
    if (token !== null) {
      // @ts-ignore
      google.accounts.oauth2.revoke(token.access_token, () => {
        // @ts-ignore
        gapi.client.setToken('');
      });
    }
  },

  async getUserInfo() {
    // @ts-ignore
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        // @ts-ignore
        Authorization: `Bearer ${gapi.client.getToken().access_token}`
      }
    });
    if (!response.ok) {
      const error = await response.json();
      throw { status: response.status, result: { error } };
    }
    return response.json();
  },

  async getFileMetadata(fileId: string) {
    // @ts-ignore
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      fields: 'id, name, appProperties, version, modifiedTime',
    });
    return response.result;
  },

  async createFolder(name: string, parentId?: string) {
    const fileMetadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    };
    // @ts-ignore
    const response = await gapi.client.drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    });
    return response.result.id;
  },

  async createFile(name: string, content: string, mimeType: string, parentId?: string, appProperties?: Record<string, string>) {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const metadata = {
      name: name,
      mimeType: mimeType,
      parents: parentId ? [parentId] : undefined,
      appProperties: appProperties,
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + mimeType + '\r\n\r\n' +
      content +
      close_delim;

    // @ts-ignore
    const response = await gapi.client.request({
      path: '/upload/drive/v3/files',
      method: 'POST',
      params: { uploadType: 'multipart' },
      headers: {
        'Content-Type': 'multipart/related; boundary="' + boundary + '"',
      },
      body: multipartRequestBody,
    });

    return response.result.id;
  },

  async updateFile(fileId: string, content: string, appProperties?: Record<string, string>) {
    // metadata update is separate in some cases but let's try patch
    if (appProperties) {
      // @ts-ignore
      await gapi.client.drive.files.update({
        fileId: fileId,
        resource: { appProperties },
      });
    }

    // @ts-ignore
    await gapi.client.request({
      path: `/upload/drive/v3/files/${fileId}`,
      method: 'PATCH',
      params: { uploadType: 'media' },
      body: content,
    });
  },

  async deleteFile(fileId: string) {
    // @ts-ignore
    await gapi.client.drive.files.delete({
      fileId: fileId,
    });
  },

  async findFileByName(name: string, parentId?: string) {
    // @ts-ignore
    if (!gapi.client.drive) {
      throw new Error("Google Drive API not loaded");
    }
    let q = `name='${name}' and trashed=false`;
    if (parentId) {
      q += ` and '${parentId}' in parents`;
    }
    // @ts-ignore
    const response = await gapi.client.drive.files.list({
      q: q,
      fields: 'files(id, name, appProperties)',
    });
    return response.result.files?.[0] || null;
  },
};
