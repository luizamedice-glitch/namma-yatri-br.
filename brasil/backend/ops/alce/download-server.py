#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Expiring private capability downloads. Loopback only; no directory listing."""
import hmac,json,re,sys,time
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer

def handler(root,metadata,clock=time.time):
    class Download(BaseHTTPRequestHandler):
        def log_message(self,*args):pass  # URL contains a private capability.
        def do_HEAD(self):self.transfer(False)
        def do_GET(self):self.transfer(True)
        def transfer(self,body):
            self.connection.settimeout(30)
            if self.path=='/health':
                self.send_response(200);self.send_header('Content-Length','0');self.end_headers();return
            parts=self.path.split('/')
            if (clock()>=metadata['expiresAt'] or len(parts)!=4 or parts[1]!='lab-apks' or
                not hmac.compare_digest(parts[2],metadata['token']) or parts[3] not in metadata['files']):
                self.send_response(404);self.send_header('Content-Length','0');self.end_headers();return
            name=parts[3];info=metadata['files'][name];path=root/name
            if not path.is_file() or path.stat().st_size!=info['size']:
                self.send_response(503);self.send_header('Content-Length','0');self.end_headers();return
            size=info['size'];start=0;end=size-1;status=200
            requested=self.headers.get('Range')
            if requested and self.headers.get('If-Range','"'+info['sha256']+'"')=='"'+info['sha256']+'"':
                match=re.fullmatch(r'bytes=(\d+)-(\d*)',requested)
                if not match or int(match[1])>=size or (match[2] and int(match[2])<int(match[1])):
                    self.send_response(416);self.send_header('Content-Range',f'bytes */{size}')
                    self.send_header('Content-Length','0');self.end_headers();return
                start=int(match[1]);end=min(size-1,int(match[2])) if match[2] else size-1;status=206
            self.send_response(status)
            self.send_header('Content-Type','text/plain; charset=utf-8' if name.endswith('.txt') else 'application/vnd.android.package-archive')
            self.send_header('Content-Disposition',f'attachment; filename="{name}"')
            self.send_header('Content-Length',str(end-start+1));self.send_header('Accept-Ranges','bytes')
            self.send_header('ETag','"'+info['sha256']+'"');self.send_header('Cache-Control','private, no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            if status==206:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
            self.end_headers()
            if body:
                try:
                    with path.open('rb') as stream:
                        stream.seek(start);remaining=end-start+1
                        while remaining:
                            chunk=stream.read(min(65536,remaining))
                            if not chunk:break
                            self.wfile.write(chunk);remaining-=len(chunk)
                except (BrokenPipeError,ConnectionResetError,TimeoutError):pass
    return Download

if __name__=='__main__':
    root=Path(sys.argv[1]);metadata=json.loads((root/'metadata.json').read_text())
    ThreadingHTTPServer(('127.0.0.1',8085),handler(root,metadata)).serve_forever()
