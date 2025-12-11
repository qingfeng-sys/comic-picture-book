import http from 'http';
import { NextRequest, NextResponse } from 'next/server';

export function createServer(handler: (req: NextRequest) => Promise<NextResponse>) {
  return http.createServer(async (req, res) => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Uint8Array);
    }
    const body = Buffer.concat(chunks).toString();

    const url = `http://localhost${req.url}`;
    const nextReq = new NextRequest(
      new Request(url, {
        method: req.method,
        headers: req.headers as any,
        body: ['GET', 'HEAD'].includes(req.method || '') ? undefined : body,
      })
    );

    const nextRes = await handler(nextReq);
    res.statusCode = nextRes.status;
    nextRes.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const resBody = await nextRes.arrayBuffer();
    res.end(Buffer.from(resBody));
  });
}

