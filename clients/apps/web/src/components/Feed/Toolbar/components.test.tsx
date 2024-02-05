import { youtubeIdFromURL } from './useMarkdownComponents'

test('youtubeIdFromURL', () => {
  expect(
    youtubeIdFromURL('https://www.youtube.com/watch?v=86Gy035z_KA'),
  ).toStrictEqual('86Gy035z_KA')

  expect(
    youtubeIdFromURL('https://www.youtube.com/watch?v=86Gy035z_KA&t=10'),
  ).toStrictEqual('86Gy035z_KA')

  expect(
    youtubeIdFromURL('https://m.youtube.com/watch?v=86Gy035z_KA&t=10'),
  ).toStrictEqual('86Gy035z_KA')

  expect(
    youtubeIdFromURL('https://youtu.be/86Gy035z_KA?si=o__Vh0bePjpLiZ3i&t=107'),
  ).toStrictEqual('86Gy035z_KA')

  expect(
    youtubeIdFromURL(
      'https://www.youtube.com/embed/86Gy035z_KA?si=o__Vh0bePjpLiZ3i',
    ),
  ).toStrictEqual('86Gy035z_KA')
})
