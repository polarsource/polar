export const runtime = 'edge'

export async function GET() {
  return new Response(
    JSON.stringify({
      applinks: {
        details: [
          {
            appID: '55U3YA3QTA.com.polarsource.Polar',
            paths: ['/oauth/callback/*'],
          },
        ],
      },
    }),
    {
      status: 200,
    },
  )
}
