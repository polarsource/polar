#!/bin/sh
set -eu

# Use TrueType (glyf) fonts: PDF.js cannot render the CFF/OTF subsets in fonts-noto-cjk.
# Keep the versioned gstatic URLs and their checksums pinned together.
mkdir /fonts
cd /fonts
curl -fsSLo NotoSansTC-Regular.ttf 'https://fonts.gstatic.com/s/notosanstc/v39/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz76Cy_Co.ttf'
curl -fsSLo NotoSansTC-Bold.ttf    'https://fonts.gstatic.com/s/notosanstc/v39/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz70e1_Co.ttf'
curl -fsSLo NotoSansSC-Regular.ttf 'https://fonts.gstatic.com/s/notosanssc/v40/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYw.ttf'
curl -fsSLo NotoSansSC-Bold.ttf    'https://fonts.gstatic.com/s/notosanssc/v40/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaGzjCnYw.ttf'
curl -fsSLo NotoSansJP-Regular.ttf 'https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf'
curl -fsSLo NotoSansJP-Bold.ttf    'https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFPYk75s.ttf'
curl -fsSLo NotoSansKR-Regular.ttf 'https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLQ.ttf'
curl -fsSLo NotoSansKR-Bold.ttf    'https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzg01eLQ.ttf'
sha256sum -c <<CHECKSUMS
619662a0583f38311e92666927e5edbfd30f2a1fbe8593685660bd11bdd46a10  NotoSansTC-Regular.ttf
33e8464f3432fd9eba5fa6ff74f5fb9ee612cad703877bd71c36e6f167c0a7e3  NotoSansTC-Bold.ttf
450625c8d46ab3df97b7904ded955ec2746d17ec76740cb1e91d1ba63a0f89af  NotoSansSC-Regular.ttf
0066a522a1ac007c1d72bc4fccb114f80ff7294641c78cead9715bd14d43b9ea  NotoSansSC-Bold.ttf
4593dfcdc70ee68852606c90d75dfc6e022feda12780a55615239c53c54ef086  NotoSansJP-Regular.ttf
a3910e15eea0451ffbea62e894e951ea9f7c812c8b4b5e947593b6ecc2d4b057  NotoSansJP-Bold.ttf
c733940a7dc687142848b30a491e97138ed58dc58c4cae33c44e3ee52da411cb  NotoSansKR-Regular.ttf
5ebb0def0fe9e7c853253eca8ec9c1066adc479f2e248533b412ed0c6a663abc  NotoSansKR-Bold.ttf
CHECKSUMS
