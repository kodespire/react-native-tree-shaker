# Benchmark results

## rn-template (ios)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| rn-cli | 865.1 KiB | 212.6 KiB | 168.6 KiB | 1227.3 KiB | 534 | 7.7 s |
| rn-cli-getters | 756.6 KiB | 191.7 KiB | 153.8 KiB | 1091.3 KiB | 434 | 5.3 s |
| rn-cli-shaker | 740.0 KiB | 190.4 KiB | 153.0 KiB | 1060.2 KiB | 429 | 7.3 s |

### rn-template/ios/rn-cli → rn-template/ios/rn-cli-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 865.1 KiB | 756.6 KiB | −108.5 KiB | −12.5% |
| Gzip | 212.6 KiB | 191.7 KiB | −21.0 KiB | −9.9% |
| Brotli | 168.6 KiB | 153.8 KiB | −14.8 KiB | −8.8% |
| Hermes bytecode | 1.20 MiB | 1.07 MiB | −136.0 KiB | −11.1% |
| Modules | 534 | 434 | −100 | −18.7% |

### Biggest package changes (top 2 of 2)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 666.8 KiB | 571.4 KiB | −95.4 KiB | −14.3% |
| (unmapped) | 72.4 KiB | 59.3 KiB | −13.1 KiB | −18.1% |

### rn-template/ios/rn-cli → rn-template/ios/rn-cli-shaker

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 865.1 KiB | 740.0 KiB | −125.1 KiB | −14.5% |
| Gzip | 212.6 KiB | 190.4 KiB | −22.2 KiB | −10.5% |
| Brotli | 168.6 KiB | 153.0 KiB | −15.6 KiB | −9.2% |
| Hermes bytecode | 1.20 MiB | 1.04 MiB | −167.2 KiB | −13.6% |
| Modules | 534 | 429 | −105 | −19.7% |

### Biggest package changes (top 7 of 7)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 666.8 KiB | 563.2 KiB | −103.5 KiB | −15.5% |
| (unmapped) | 72.4 KiB | 56.2 KiB | −16.3 KiB | −22.4% |
| react | 8.0 KiB | 5.3 KiB | −2.6 KiB | −33.0% |
| react-native-safe-area-context | 4.2 KiB | 1.9 KiB | −2.3 KiB | −54.3% |
| scheduler | 3.9 KiB | 3.6 KiB | −259 B | −6.5% |
| @react-native/virtualized-lists | 54.9 KiB | 54.8 KiB | −75 B | −0.1% |
| base64-js | 1.4 KiB | 1.3 KiB | −70 B | −5.0% |

## rn-template (android)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| rn-cli | 869.0 KiB | 214.2 KiB | 170.0 KiB | 1231.0 KiB | 530 | 5.3 s |
| rn-cli-getters | 759.5 KiB | 192.7 KiB | 154.6 KiB | 1094.4 KiB | 433 | 5.4 s |
| rn-cli-shaker | 744.0 KiB | 191.4 KiB | 153.9 KiB | 1063.7 KiB | 428 | 5.8 s |

### rn-template/android/rn-cli → rn-template/android/rn-cli-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 869.0 KiB | 759.5 KiB | −109.5 KiB | −12.6% |
| Gzip | 214.2 KiB | 192.7 KiB | −21.5 KiB | −10.0% |
| Brotli | 170.0 KiB | 154.6 KiB | −15.4 KiB | −9.1% |
| Hermes bytecode | 1.20 MiB | 1.07 MiB | −136.6 KiB | −11.1% |
| Modules | 530 | 433 | −97 | −18.3% |

### Biggest package changes (top 2 of 2)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 670.5 KiB | 574.3 KiB | −96.2 KiB | −14.4% |
| (unmapped) | 72.6 KiB | 59.3 KiB | −13.2 KiB | −18.3% |

### rn-template/android/rn-cli → rn-template/android/rn-cli-shaker

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 869.0 KiB | 744.0 KiB | −125.0 KiB | −14.4% |
| Gzip | 214.2 KiB | 191.4 KiB | −22.7 KiB | −10.6% |
| Brotli | 170.0 KiB | 153.9 KiB | −16.1 KiB | −9.5% |
| Hermes bytecode | 1.20 MiB | 1.04 MiB | −167.3 KiB | −13.6% |
| Modules | 530 | 428 | −102 | −19.2% |

### Biggest package changes (top 7 of 7)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 670.5 KiB | 566.9 KiB | −103.6 KiB | −15.4% |
| (unmapped) | 72.6 KiB | 56.4 KiB | −16.2 KiB | −22.3% |
| react | 8.0 KiB | 5.3 KiB | −2.6 KiB | −33.0% |
| react-native-safe-area-context | 4.2 KiB | 1.9 KiB | −2.3 KiB | −54.3% |
| scheduler | 3.9 KiB | 3.6 KiB | −259 B | −6.5% |
| @react-native/virtualized-lists | 54.9 KiB | 54.8 KiB | −75 B | −0.1% |
| base64-js | 1.4 KiB | 1.3 KiB | −70 B | −5.0% |

## expo-default (ios)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 2386.7 KiB | 555.6 KiB | 434.4 KiB | 3539.1 KiB | 1545 | 12.3 s |
| expo-tree-shaking | 2082.6 KiB | 504.9 KiB | 397.1 KiB | 3106.2 KiB | 1398 | 19.4 s |
| expo-getters | 2307.5 KiB | 541.0 KiB | 423.5 KiB | 3434.6 KiB | 1464 | 2.1 s |
| expo-shaker | 1922.4 KiB | 481.2 KiB | 378.5 KiB | 2892.8 KiB | 1294 | 10.7 s |
| expo-tree-shaking-getters | 2082.6 KiB | 505.0 KiB | 397.4 KiB | 3106.2 KiB | 1398 | 18.6 s |

### expo-default/ios/expo → expo-default/ios/expo-tree-shaking

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 2.33 MiB | 2.03 MiB | −304.1 KiB | −12.7% |
| Gzip | 555.6 KiB | 504.9 KiB | −50.6 KiB | −9.1% |
| Brotli | 434.4 KiB | 397.1 KiB | −37.4 KiB | −8.6% |
| Hermes bytecode | 3.46 MiB | 3.03 MiB | −432.9 KiB | −12.2% |
| Modules | 1545 | 1398 | −147 | −9.5% |

### Biggest package changes (top 10 of 18)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native-reanimated | 627.5 KiB | 396.2 KiB | −231.3 KiB | −36.9% |
| semver | 17.6 KiB | 0 B | −17.6 KiB | −100.0% |
| react-native | 593.9 KiB | 577.4 KiB | −16.6 KiB | −2.8% |
| react-native-worklets | 102.9 KiB | 91.0 KiB | −12.0 KiB | −11.6% |
| (unmapped) | 144.1 KiB | 133.2 KiB | −10.9 KiB | −7.6% |
| expo | 100.8 KiB | 92.1 KiB | −8.7 KiB | −8.6% |
| expo-modules-core | 14.9 KiB | 13.0 KiB | −1.9 KiB | −13.0% |
| expo-web-browser | 2.7 KiB | 1.2 KiB | −1.5 KiB | −54.9% |
| expo-image | 11.3 KiB | 9.9 KiB | −1.3 KiB | −11.7% |
| (app) | 21.3 KiB | 20.4 KiB | −931 B | −4.3% |

### expo-default/ios/expo → expo-default/ios/expo-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 2.33 MiB | 2.25 MiB | −79.1 KiB | −3.3% |
| Gzip | 555.6 KiB | 541.0 KiB | −14.6 KiB | −2.6% |
| Brotli | 434.4 KiB | 423.5 KiB | −10.9 KiB | −2.5% |
| Hermes bytecode | 3.46 MiB | 3.35 MiB | −104.4 KiB | −3.0% |
| Modules | 1545 | 1464 | −81 | −5.2% |

### Biggest package changes (top 3 of 3)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 593.9 KiB | 530.3 KiB | −63.7 KiB | −10.7% |
| (unmapped) | 144.1 KiB | 129.7 KiB | −14.4 KiB | −10.0% |
| flow-enums-runtime | 1.1 KiB | 0 B | −1.1 KiB | −100.0% |

### expo-default/ios/expo → expo-default/ios/expo-shaker

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 2.33 MiB | 1.88 MiB | −464.3 KiB | −19.5% |
| Gzip | 555.6 KiB | 481.2 KiB | −74.4 KiB | −13.4% |
| Brotli | 434.4 KiB | 378.5 KiB | −56.0 KiB | −12.9% |
| Hermes bytecode | 3.46 MiB | 2.82 MiB | −646.3 KiB | −18.3% |
| Modules | 1545 | 1294 | −251 | −16.2% |

### Biggest package changes (top 10 of 30)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native-reanimated | 627.5 KiB | 346.9 KiB | −280.6 KiB | −44.7% |
| react-native | 593.9 KiB | 515.2 KiB | −78.8 KiB | −13.3% |
| (unmapped) | 144.1 KiB | 120.4 KiB | −23.7 KiB | −16.5% |
| semver | 17.6 KiB | 0 B | −17.6 KiB | −100.0% |
| expo | 100.8 KiB | 88.2 KiB | −12.6 KiB | −12.5% |
| react-native-screens | 67.3 KiB | 58.2 KiB | −9.1 KiB | −13.5% |
| react-native-worklets | 102.9 KiB | 94.5 KiB | −8.4 KiB | −8.2% |
| expo-modules-core | 14.9 KiB | 6.7 KiB | −8.2 KiB | −55.2% |
| expo-asset | 6.5 KiB | 0 B | −6.5 KiB | −100.0% |
| expo-router | 479.8 KiB | 476.6 KiB | −3.2 KiB | −0.7% |

### expo-default/ios/expo → expo-default/ios/expo-tree-shaking-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 2.33 MiB | 2.03 MiB | −304.1 KiB | −12.7% |
| Gzip | 555.6 KiB | 505.0 KiB | −50.6 KiB | −9.1% |
| Brotli | 434.4 KiB | 397.4 KiB | −37.0 KiB | −8.5% |
| Hermes bytecode | 3.46 MiB | 3.03 MiB | −432.9 KiB | −12.2% |
| Modules | 1545 | 1398 | −147 | −9.5% |

### Biggest package changes (top 10 of 18)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native-reanimated | 627.5 KiB | 396.2 KiB | −231.3 KiB | −36.9% |
| semver | 17.6 KiB | 0 B | −17.6 KiB | −100.0% |
| react-native | 593.9 KiB | 577.4 KiB | −16.6 KiB | −2.8% |
| react-native-worklets | 102.9 KiB | 91.0 KiB | −12.0 KiB | −11.6% |
| (unmapped) | 144.1 KiB | 133.2 KiB | −10.9 KiB | −7.6% |
| expo | 100.8 KiB | 92.1 KiB | −8.7 KiB | −8.6% |
| expo-modules-core | 14.9 KiB | 13.0 KiB | −1.9 KiB | −13.0% |
| expo-web-browser | 2.7 KiB | 1.2 KiB | −1.5 KiB | −54.9% |
| expo-image | 11.3 KiB | 9.9 KiB | −1.3 KiB | −11.7% |
| (app) | 21.3 KiB | 20.4 KiB | −931 B | −4.3% |

## expo-default (android)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 2546.2 KiB | 602.6 KiB | 472.1 KiB | 3752.8 KiB | 1642 | 9.4 s |
| expo-tree-shaking | 2246.3 KiB | 553.0 KiB | 435.0 KiB | 3314.2 KiB | 1496 | 21.8 s |
| expo-getters | 2466.4 KiB | 588.3 KiB | 460.9 KiB | 3648.2 KiB | 1564 | 2.2 s |
| expo-shaker | 2081.2 KiB | 527.5 KiB | 416.0 KiB | 3100.0 KiB | 1398 | 11.2 s |
| expo-tree-shaking-getters | 2246.3 KiB | 553.0 KiB | 435.2 KiB | 3314.2 KiB | 1496 | 21.1 s |

### expo-default/android/expo → expo-default/android/expo-tree-shaking

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 2.49 MiB | 2.19 MiB | −300.0 KiB | −11.8% |
| Gzip | 602.6 KiB | 553.0 KiB | −49.6 KiB | −8.2% |
| Brotli | 472.1 KiB | 435.0 KiB | −37.1 KiB | −7.9% |
| Hermes bytecode | 3.66 MiB | 3.24 MiB | −438.6 KiB | −11.7% |
| Modules | 1642 | 1496 | −146 | −8.9% |

### Biggest package changes (top 10 of 19)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native-reanimated | 627.2 KiB | 396.1 KiB | −231.1 KiB | −36.9% |
| semver | 17.6 KiB | 0 B | −17.6 KiB | −100.0% |
| react-native | 598.0 KiB | 583.3 KiB | −14.7 KiB | −2.5% |
| (unmapped) | 155.6 KiB | 145.0 KiB | −10.5 KiB | −6.8% |
| expo | 101.0 KiB | 92.3 KiB | −8.7 KiB | −8.6% |
| react-native-worklets | 102.9 KiB | 94.8 KiB | −8.1 KiB | −7.9% |
| expo-font | 9.8 KiB | 6.3 KiB | −3.5 KiB | −35.9% |
| expo-web-browser | 3.6 KiB | 1.3 KiB | −2.2 KiB | −62.2% |
| expo-modules-core | 15.2 KiB | 13.0 KiB | −2.2 KiB | −14.2% |
| @expo/ui | 70.0 KiB | 71.9 KiB | +1.9 KiB | +2.8% |

### expo-default/android/expo → expo-default/android/expo-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 2.49 MiB | 2.41 MiB | −79.8 KiB | −3.1% |
| Gzip | 602.6 KiB | 588.3 KiB | −14.3 KiB | −2.4% |
| Brotli | 472.1 KiB | 460.9 KiB | −11.2 KiB | −2.4% |
| Hermes bytecode | 3.66 MiB | 3.56 MiB | −104.6 KiB | −2.8% |
| Modules | 1642 | 1564 | −78 | −4.8% |

### Biggest package changes (top 3 of 3)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 598.0 KiB | 533.7 KiB | −64.2 KiB | −10.7% |
| (unmapped) | 155.6 KiB | 141.1 KiB | −14.5 KiB | −9.3% |
| flow-enums-runtime | 1.1 KiB | 0 B | −1.1 KiB | −100.0% |

### expo-default/android/expo → expo-default/android/expo-shaker

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 2.49 MiB | 2.03 MiB | −465.0 KiB | −18.3% |
| Gzip | 602.6 KiB | 527.5 KiB | −75.1 KiB | −12.5% |
| Brotli | 472.1 KiB | 416.0 KiB | −56.2 KiB | −11.9% |
| Hermes bytecode | 3.66 MiB | 3.03 MiB | −652.8 KiB | −17.4% |
| Modules | 1642 | 1398 | −244 | −14.9% |

### Biggest package changes (top 10 of 31)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native-reanimated | 627.2 KiB | 346.9 KiB | −280.2 KiB | −44.7% |
| react-native | 598.0 KiB | 520.0 KiB | −77.9 KiB | −13.0% |
| (unmapped) | 155.6 KiB | 132.5 KiB | −23.1 KiB | −14.8% |
| semver | 17.6 KiB | 0 B | −17.6 KiB | −100.0% |
| expo | 101.0 KiB | 88.8 KiB | −12.3 KiB | −12.1% |
| expo-router | 469.5 KiB | 458.9 KiB | −10.6 KiB | −2.3% |
| react-native-worklets | 102.9 KiB | 94.5 KiB | −8.4 KiB | −8.2% |
| react-native-screens | 62.4 KiB | 54.2 KiB | −8.3 KiB | −13.2% |
| expo-modules-core | 15.2 KiB | 9.1 KiB | −6.1 KiB | −39.9% |
| expo-font | 9.8 KiB | 6.1 KiB | −3.7 KiB | −37.5% |

### expo-default/android/expo → expo-default/android/expo-tree-shaking-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 2.49 MiB | 2.19 MiB | −300.0 KiB | −11.8% |
| Gzip | 602.6 KiB | 553.0 KiB | −49.6 KiB | −8.2% |
| Brotli | 472.1 KiB | 435.2 KiB | −36.9 KiB | −7.8% |
| Hermes bytecode | 3.66 MiB | 3.24 MiB | −438.6 KiB | −11.7% |
| Modules | 1642 | 1496 | −146 | −8.9% |

### Biggest package changes (top 10 of 19)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native-reanimated | 627.2 KiB | 396.1 KiB | −231.1 KiB | −36.9% |
| semver | 17.6 KiB | 0 B | −17.6 KiB | −100.0% |
| react-native | 598.0 KiB | 583.3 KiB | −14.7 KiB | −2.5% |
| (unmapped) | 155.6 KiB | 145.0 KiB | −10.5 KiB | −6.8% |
| expo | 101.0 KiB | 92.3 KiB | −8.7 KiB | −8.6% |
| react-native-worklets | 102.9 KiB | 94.8 KiB | −8.1 KiB | −7.9% |
| expo-font | 9.8 KiB | 6.3 KiB | −3.5 KiB | −35.9% |
| expo-web-browser | 3.6 KiB | 1.3 KiB | −2.2 KiB | −62.2% |
| expo-modules-core | 15.2 KiB | 13.0 KiB | −2.2 KiB | −14.2% |
| @expo/ui | 70.0 KiB | 71.9 KiB | +1.9 KiB | +2.8% |

## expo-barrels (ios)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 3449.1 KiB | 546.4 KiB | 422.3 KiB | 4537.8 KiB | 3587 | 13.2 s |
| expo-tree-shaking | 1144.6 KiB | 278.7 KiB | 226.3 KiB | 1750.6 KiB | 858 | 24.4 s |
| expo-getters | 3187.0 KiB | 488.3 KiB | 375.9 KiB | 4168.9 KiB | 3392 | 2.8 s |
| expo-shaker | 876.3 KiB | 225.5 KiB | 180.1 KiB | 1368.0 KiB | 675 | 26.7 s |
| expo-tree-shaking-getters | 1144.6 KiB | 278.7 KiB | 226.4 KiB | 1750.6 KiB | 858 | 20.5 s |

### expo-barrels/ios/expo → expo-barrels/ios/expo-tree-shaking

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 3.37 MiB | 1.12 MiB | −2.25 MiB | −66.8% |
| Gzip | 546.4 KiB | 278.7 KiB | −267.8 KiB | −49.0% |
| Brotli | 422.3 KiB | 226.3 KiB | −196.0 KiB | −46.4% |
| Hermes bytecode | 4.43 MiB | 1.71 MiB | −2.72 MiB | −61.4% |
| Modules | 3587 | 858 | −2729 | −76.1% |

### Biggest package changes (top 10 of 12)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| lucide-react-native | 1.53 MiB | 6.8 KiB | −1.52 MiB | −99.6% |
| (unmapped) | 497.6 KiB | 121.4 KiB | −376.2 KiB | −75.6% |
| lodash-es | 243.0 KiB | 31.8 KiB | −211.3 KiB | −86.9% |
| date-fns | 161.7 KiB | 25.2 KiB | −136.5 KiB | −84.4% |
| react-native | 593.8 KiB | 577.2 KiB | −16.6 KiB | −2.8% |
| expo-modules-core | 14.9 KiB | 2.0 KiB | −13.0 KiB | −86.9% |
| react-native-svg | 107.3 KiB | 119.1 KiB | +11.8 KiB | +11.0% |
| expo | 91.4 KiB | 87.6 KiB | −3.8 KiB | −4.1% |
| expo-asset | 6.5 KiB | 5.6 KiB | −931 B | −13.9% |
| expo-status-bar | 1.1 KiB | 724 B | −421 B | −36.8% |

### expo-barrels/ios/expo → expo-barrels/ios/expo-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 3.37 MiB | 3.11 MiB | −262.1 KiB | −7.6% |
| Gzip | 546.4 KiB | 488.3 KiB | −58.1 KiB | −10.6% |
| Brotli | 422.3 KiB | 375.9 KiB | −46.4 KiB | −11.0% |
| Hermes bytecode | 4.43 MiB | 4.07 MiB | −368.9 KiB | −8.1% |
| Modules | 3587 | 3392 | −195 | −5.4% |

### Biggest package changes (top 5 of 5)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 593.8 KiB | 417.6 KiB | −176.2 KiB | −29.7% |
| @react-native/virtualized-lists | 48.7 KiB | 0 B | −48.7 KiB | −100.0% |
| (unmapped) | 497.6 KiB | 462.0 KiB | −35.6 KiB | −7.2% |
| flow-enums-runtime | 1.1 KiB | 0 B | −1.1 KiB | −100.0% |
| memoize-one | 443 B | 0 B | −443 B | −100.0% |

### expo-barrels/ios/expo → expo-barrels/ios/expo-shaker

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 3.37 MiB | 876.3 KiB | −2.51 MiB | −74.6% |
| Gzip | 546.4 KiB | 225.5 KiB | −320.9 KiB | −58.7% |
| Brotli | 422.3 KiB | 180.1 KiB | −242.2 KiB | −57.4% |
| Hermes bytecode | 4.43 MiB | 1.34 MiB | −3.10 MiB | −69.9% |
| Modules | 3587 | 675 | −2912 | −81.2% |

### Biggest package changes (top 10 of 20)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| lucide-react-native | 1.53 MiB | 6.2 KiB | −1.52 MiB | −99.6% |
| (unmapped) | 497.6 KiB | 102.0 KiB | −395.6 KiB | −79.5% |
| lodash-es | 243.0 KiB | 31.8 KiB | −211.3 KiB | −86.9% |
| react-native | 593.8 KiB | 408.9 KiB | −184.9 KiB | −31.1% |
| date-fns | 161.7 KiB | 23.8 KiB | −137.9 KiB | −85.3% |
| @react-native/virtualized-lists | 48.7 KiB | 0 B | −48.7 KiB | −100.0% |
| expo-modules-core | 14.9 KiB | 2.2 KiB | −12.8 KiB | −85.5% |
| expo-asset | 6.5 KiB | 0 B | −6.5 KiB | −100.0% |
| expo | 91.4 KiB | 87.0 KiB | −4.3 KiB | −4.8% |
| react-native-svg | 107.3 KiB | 103.5 KiB | −3.8 KiB | −3.5% |

### expo-barrels/ios/expo → expo-barrels/ios/expo-tree-shaking-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 3.37 MiB | 1.12 MiB | −2.25 MiB | −66.8% |
| Gzip | 546.4 KiB | 278.7 KiB | −267.8 KiB | −49.0% |
| Brotli | 422.3 KiB | 226.4 KiB | −195.9 KiB | −46.4% |
| Hermes bytecode | 4.43 MiB | 1.71 MiB | −2.72 MiB | −61.4% |
| Modules | 3587 | 858 | −2729 | −76.1% |

### Biggest package changes (top 10 of 12)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| lucide-react-native | 1.53 MiB | 6.8 KiB | −1.52 MiB | −99.6% |
| (unmapped) | 497.6 KiB | 121.4 KiB | −376.2 KiB | −75.6% |
| lodash-es | 243.0 KiB | 31.8 KiB | −211.3 KiB | −86.9% |
| date-fns | 161.7 KiB | 25.2 KiB | −136.5 KiB | −84.4% |
| react-native | 593.8 KiB | 577.2 KiB | −16.6 KiB | −2.8% |
| expo-modules-core | 14.9 KiB | 2.0 KiB | −13.0 KiB | −86.9% |
| react-native-svg | 107.3 KiB | 119.1 KiB | +11.8 KiB | +11.0% |
| expo | 91.4 KiB | 87.6 KiB | −3.8 KiB | −4.1% |
| expo-asset | 6.5 KiB | 5.6 KiB | −931 B | −13.9% |
| expo-status-bar | 1.1 KiB | 724 B | −421 B | −36.8% |

## expo-barrels (android)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 3454.4 KiB | 547.9 KiB | 423.7 KiB | 4543.4 KiB | 3586 | 9.5 s |
| expo-tree-shaking | 1152.1 KiB | 280.8 KiB | 228.0 KiB | 1757.9 KiB | 860 | 21.0 s |
| expo-getters | 3190.2 KiB | 489.4 KiB | 376.5 KiB | 4171.8 KiB | 3394 | 1.7 s |
| expo-shaker | 879.9 KiB | 226.2 KiB | 180.7 KiB | 1371.1 KiB | 677 | 11.2 s |
| expo-tree-shaking-getters | 1152.1 KiB | 280.9 KiB | 227.7 KiB | 1757.9 KiB | 860 | 14.3 s |

### expo-barrels/android/expo → expo-barrels/android/expo-tree-shaking

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 3.37 MiB | 1.13 MiB | −2.25 MiB | −66.6% |
| Gzip | 547.9 KiB | 280.8 KiB | −267.0 KiB | −48.7% |
| Brotli | 423.7 KiB | 228.0 KiB | −195.7 KiB | −46.2% |
| Hermes bytecode | 4.44 MiB | 1.72 MiB | −2.72 MiB | −61.3% |
| Modules | 3586 | 860 | −2726 | −76.0% |

### Biggest package changes (top 10 of 12)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| lucide-react-native | 1.53 MiB | 6.8 KiB | −1.52 MiB | −99.6% |
| (unmapped) | 498.0 KiB | 122.3 KiB | −375.7 KiB | −75.4% |
| lodash-es | 243.0 KiB | 31.8 KiB | −211.3 KiB | −86.9% |
| date-fns | 161.7 KiB | 25.2 KiB | −136.5 KiB | −84.4% |
| react-native | 597.9 KiB | 583.2 KiB | −14.7 KiB | −2.5% |
| expo-modules-core | 15.2 KiB | 2.0 KiB | −13.2 KiB | −87.0% |
| react-native-svg | 107.7 KiB | 119.5 KiB | +11.8 KiB | +10.9% |
| expo | 91.6 KiB | 87.8 KiB | −3.8 KiB | −4.1% |
| expo-asset | 6.6 KiB | 5.7 KiB | −931 B | −13.7% |
| expo-status-bar | 1.1 KiB | 724 B | −421 B | −36.8% |

### expo-barrels/android/expo → expo-barrels/android/expo-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 3.37 MiB | 3.12 MiB | −264.2 KiB | −7.6% |
| Gzip | 547.9 KiB | 489.4 KiB | −58.5 KiB | −10.7% |
| Brotli | 423.7 KiB | 376.5 KiB | −47.2 KiB | −11.1% |
| Hermes bytecode | 4.44 MiB | 4.07 MiB | −371.6 KiB | −8.2% |
| Modules | 3586 | 3394 | −192 | −5.4% |

### Biggest package changes (top 5 of 5)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 597.9 KiB | 419.5 KiB | −178.3 KiB | −29.8% |
| @react-native/virtualized-lists | 48.7 KiB | 0 B | −48.7 KiB | −100.0% |
| (unmapped) | 498.0 KiB | 462.4 KiB | −35.6 KiB | −7.1% |
| flow-enums-runtime | 1.1 KiB | 0 B | −1.1 KiB | −100.0% |
| memoize-one | 443 B | 0 B | −443 B | −100.0% |

### expo-barrels/android/expo → expo-barrels/android/expo-shaker

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 3.37 MiB | 879.9 KiB | −2.51 MiB | −74.5% |
| Gzip | 547.9 KiB | 226.2 KiB | −321.6 KiB | −58.7% |
| Brotli | 423.7 KiB | 180.7 KiB | −243.0 KiB | −57.4% |
| Hermes bytecode | 4.44 MiB | 1.34 MiB | −3.10 MiB | −69.8% |
| Modules | 3586 | 677 | −2909 | −81.1% |

### Biggest package changes (top 10 of 20)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| lucide-react-native | 1.53 MiB | 6.2 KiB | −1.52 MiB | −99.6% |
| (unmapped) | 498.0 KiB | 102.4 KiB | −395.6 KiB | −79.4% |
| lodash-es | 243.0 KiB | 31.8 KiB | −211.3 KiB | −86.9% |
| react-native | 597.9 KiB | 411.5 KiB | −186.4 KiB | −31.2% |
| date-fns | 161.7 KiB | 23.8 KiB | −137.9 KiB | −85.3% |
| @react-native/virtualized-lists | 48.7 KiB | 0 B | −48.7 KiB | −100.0% |
| expo-modules-core | 15.2 KiB | 2.2 KiB | −13.0 KiB | −85.7% |
| expo-asset | 6.6 KiB | 0 B | −6.6 KiB | −100.0% |
| expo | 91.6 KiB | 87.3 KiB | −4.3 KiB | −4.7% |
| react-native-svg | 107.7 KiB | 103.9 KiB | −3.8 KiB | −3.5% |

### expo-barrels/android/expo → expo-barrels/android/expo-tree-shaking-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 3.37 MiB | 1.13 MiB | −2.25 MiB | −66.6% |
| Gzip | 547.9 KiB | 280.9 KiB | −267.0 KiB | −48.7% |
| Brotli | 423.7 KiB | 227.7 KiB | −196.0 KiB | −46.2% |
| Hermes bytecode | 4.44 MiB | 1.72 MiB | −2.72 MiB | −61.3% |
| Modules | 3586 | 860 | −2726 | −76.0% |

### Biggest package changes (top 10 of 12)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| lucide-react-native | 1.53 MiB | 6.8 KiB | −1.52 MiB | −99.6% |
| (unmapped) | 498.0 KiB | 122.3 KiB | −375.7 KiB | −75.4% |
| lodash-es | 243.0 KiB | 31.8 KiB | −211.3 KiB | −86.9% |
| date-fns | 161.7 KiB | 25.2 KiB | −136.5 KiB | −84.4% |
| react-native | 597.9 KiB | 583.2 KiB | −14.7 KiB | −2.5% |
| expo-modules-core | 15.2 KiB | 2.0 KiB | −13.2 KiB | −87.0% |
| react-native-svg | 107.7 KiB | 119.5 KiB | +11.8 KiB | +10.9% |
| expo | 91.6 KiB | 87.8 KiB | −3.8 KiB | −4.1% |
| expo-asset | 6.6 KiB | 5.7 KiB | −931 B | −13.7% |
| expo-status-bar | 1.1 KiB | 724 B | −421 B | −36.8% |

## bare-expo (ios)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 1519.3 KiB | 403.4 KiB | 301.1 KiB | 2198.1 KiB | 635 | 7.5 s |
| expo-tree-shaking | 1519.3 KiB | 403.4 KiB | 301.1 KiB | 2198.1 KiB | 635 | 14.0 s |
| expo-getters | 1426.8 KiB | 384.4 KiB | 288.0 KiB | 2082.7 KiB | 560 | 1.2 s |
| expo-shaker | 1408.2 KiB | 383.4 KiB | 287.1 KiB | 2044.1 KiB | 555 | 2.6 s |
| expo-tree-shaking-getters | 1520.0 KiB | 403.5 KiB | 301.4 KiB | 2198.1 KiB | 635 | 8.8 s |

### bare-expo/ios/expo → bare-expo/ios/expo-tree-shaking

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 1.48 MiB | 1.48 MiB | +9 B | +0.0% |
| Gzip | 403.4 KiB | 403.4 KiB | +7 B | +0.0% |
| Brotli | 301.1 KiB | 301.1 KiB | +2 B | +0.0% |
| Hermes bytecode | 2.15 MiB | 2.15 MiB | +9 B | +0.0% |
| Modules | 635 | 635 | 0 | 0.0% |

### Biggest package changes (top 1 of 1)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| (unmapped) | 79.1 KiB | 79.1 KiB | +9 B | +0.0% |

### bare-expo/ios/expo → bare-expo/ios/expo-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 1.48 MiB | 1.39 MiB | −92.5 KiB | −6.1% |
| Gzip | 403.4 KiB | 384.4 KiB | −19.0 KiB | −4.7% |
| Brotli | 301.1 KiB | 288.0 KiB | −13.1 KiB | −4.3% |
| Hermes bytecode | 2.15 MiB | 2.03 MiB | −115.5 KiB | −5.3% |
| Modules | 635 | 560 | −75 | −11.8% |

### Biggest package changes (top 2 of 2)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 987.9 KiB | 904.7 KiB | −83.2 KiB | −8.4% |
| (unmapped) | 79.1 KiB | 69.8 KiB | −9.3 KiB | −11.7% |

### bare-expo/ios/expo → bare-expo/ios/expo-shaker

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 1.48 MiB | 1.38 MiB | −111.1 KiB | −7.3% |
| Gzip | 403.4 KiB | 383.4 KiB | −20.0 KiB | −5.0% |
| Brotli | 301.1 KiB | 287.1 KiB | −14.0 KiB | −4.7% |
| Hermes bytecode | 2.15 MiB | 2.00 MiB | −154.0 KiB | −7.0% |
| Modules | 635 | 555 | −80 | −12.6% |

### Biggest package changes (top 10 of 10)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 987.9 KiB | 895.0 KiB | −92.9 KiB | −9.4% |
| (unmapped) | 79.1 KiB | 66.3 KiB | −12.8 KiB | −16.2% |
| react-native-safe-area-context | 4.2 KiB | 2.1 KiB | −2.2 KiB | −51.5% |
| react-is | 4.1 KiB | 2.3 KiB | −1.8 KiB | −43.7% |
| scheduler | 7.9 KiB | 7.4 KiB | −518 B | −6.4% |
| react-refresh | 5.2 KiB | 4.8 KiB | −463 B | −8.7% |
| pretty-format | 14.6 KiB | 14.3 KiB | −383 B | −2.6% |
| @react-native/virtualized-lists | 51.5 KiB | 51.5 KiB | −75 B | −0.1% |
| base64-js | 1.4 KiB | 1.3 KiB | −70 B | −5.0% |
| promise | 5.2 KiB | 5.2 KiB | −27 B | −0.5% |

### bare-expo/ios/expo → bare-expo/ios/expo-tree-shaking-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 1.48 MiB | 1.48 MiB | +659 B | +0.0% |
| Gzip | 403.4 KiB | 403.5 KiB | +32 B | +0.0% |
| Brotli | 301.1 KiB | 301.4 KiB | +345 B | +0.1% |
| Hermes bytecode | 2.15 MiB | 2.15 MiB | +17 B | +0.0% |
| Modules | 635 | 635 | 0 | 0.0% |

### Biggest package changes (top 1 of 1)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| (unmapped) | 79.1 KiB | 79.7 KiB | +659 B | +0.8% |

## bare-expo (android)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 1525.7 KiB | 404.3 KiB | 302.3 KiB | 2205.1 KiB | 639 | 7.2 s |
| expo-tree-shaking | 1525.7 KiB | 404.3 KiB | 302.3 KiB | 2205.1 KiB | 639 | 13.5 s |
| expo-getters | 1425.7 KiB | 384.4 KiB | 287.9 KiB | 2080.2 KiB | 557 | 1.2 s |
| expo-shaker | 1407.9 KiB | 383.5 KiB | 287.3 KiB | 2043.0 KiB | 552 | 2.6 s |
| expo-tree-shaking-getters | 1526.4 KiB | 404.3 KiB | 302.2 KiB | 2205.1 KiB | 639 | 8.7 s |

### bare-expo/android/expo → bare-expo/android/expo-tree-shaking

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 1.49 MiB | 1.49 MiB | +9 B | +0.0% |
| Gzip | 404.3 KiB | 404.3 KiB | +3 B | +0.0% |
| Brotli | 302.3 KiB | 302.3 KiB | +3 B | +0.0% |
| Hermes bytecode | 2.15 MiB | 2.15 MiB | +9 B | +0.0% |
| Modules | 639 | 639 | 0 | 0.0% |

### Biggest package changes (top 1 of 1)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| (unmapped) | 80.3 KiB | 80.3 KiB | +9 B | +0.0% |

### bare-expo/android/expo → bare-expo/android/expo-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 1.49 MiB | 1.39 MiB | −100.0 KiB | −6.6% |
| Gzip | 404.3 KiB | 384.4 KiB | −19.9 KiB | −4.9% |
| Brotli | 302.3 KiB | 287.9 KiB | −14.4 KiB | −4.8% |
| Hermes bytecode | 2.15 MiB | 2.03 MiB | −124.9 KiB | −5.7% |
| Modules | 639 | 557 | −82 | −12.8% |

### Biggest package changes (top 2 of 2)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 993.1 KiB | 903.9 KiB | −89.3 KiB | −9.0% |
| (unmapped) | 80.3 KiB | 69.5 KiB | −10.7 KiB | −13.4% |

### bare-expo/android/expo → bare-expo/android/expo-shaker

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 1.49 MiB | 1.37 MiB | −117.8 KiB | −7.7% |
| Gzip | 404.3 KiB | 383.5 KiB | −20.8 KiB | −5.1% |
| Brotli | 302.3 KiB | 287.3 KiB | −15.0 KiB | −5.0% |
| Hermes bytecode | 2.15 MiB | 2.00 MiB | −162.1 KiB | −7.4% |
| Modules | 639 | 552 | −87 | −13.6% |

### Biggest package changes (top 10 of 10)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 993.1 KiB | 894.9 KiB | −98.2 KiB | −9.9% |
| (unmapped) | 80.3 KiB | 66.1 KiB | −14.1 KiB | −17.6% |
| react-native-safe-area-context | 4.2 KiB | 2.1 KiB | −2.2 KiB | −51.5% |
| react-is | 4.1 KiB | 2.3 KiB | −1.8 KiB | −43.7% |
| scheduler | 7.9 KiB | 7.4 KiB | −518 B | −6.4% |
| react-refresh | 5.2 KiB | 4.8 KiB | −463 B | −8.7% |
| pretty-format | 14.6 KiB | 14.3 KiB | −383 B | −2.6% |
| @react-native/virtualized-lists | 51.5 KiB | 51.5 KiB | −75 B | −0.1% |
| base64-js | 1.4 KiB | 1.3 KiB | −70 B | −5.0% |
| promise | 5.2 KiB | 5.2 KiB | −27 B | −0.5% |

### bare-expo/android/expo → bare-expo/android/expo-tree-shaking-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 1.49 MiB | 1.49 MiB | +659 B | +0.0% |
| Gzip | 404.3 KiB | 404.3 KiB | +30 B | +0.0% |
| Brotli | 302.3 KiB | 302.2 KiB | −147 B | −0.0% |
| Hermes bytecode | 2.15 MiB | 2.15 MiB | +17 B | +0.0% |
| Modules | 639 | 639 | 0 | 0.0% |

### Biggest package changes (top 1 of 1)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| (unmapped) | 80.3 KiB | 80.9 KiB | +659 B | +0.8% |

## bare-expo-preset (ios)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 846.8 KiB | 208.2 KiB | 170.9 KiB | 1266.5 KiB | 510 | 5.0 s |
| expo-tree-shaking | 822.1 KiB | 205.0 KiB | 168.8 KiB | 1231.4 KiB | 481 | 7.6 s |
| expo-getters | 754.3 KiB | 190.2 KiB | 157.4 KiB | 1142.2 KiB | 409 | 1.2 s |
| expo-shaker | 734.2 KiB | 188.2 KiB | 156.0 KiB | 1113.5 KiB | 404 | 2.0 s |
| expo-tree-shaking-getters | 822.1 KiB | 205.0 KiB | 168.8 KiB | 1231.4 KiB | 481 | 5.2 s |

### bare-expo-preset/ios/expo → bare-expo-preset/ios/expo-tree-shaking

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 846.8 KiB | 822.1 KiB | −24.7 KiB | −2.9% |
| Gzip | 208.2 KiB | 205.0 KiB | −3.1 KiB | −1.5% |
| Brotli | 170.9 KiB | 168.8 KiB | −2.1 KiB | −1.3% |
| Hermes bytecode | 1.24 MiB | 1.20 MiB | −35.1 KiB | −2.8% |
| Modules | 510 | 481 | −29 | −5.7% |

### Biggest package changes (top 5 of 5)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 592.2 KiB | 575.8 KiB | −16.4 KiB | −2.8% |
| (unmapped) | 79.6 KiB | 73.6 KiB | −6.0 KiB | −7.6% |
| react-native-safe-area-context | 4.4 KiB | 2.0 KiB | −2.3 KiB | −53.2% |
| @react-native/new-app-screen | 5.1 KiB | 5.1 KiB | −20 B | −0.4% |
| @react-native/virtualized-lists | 48.7 KiB | 48.7 KiB | −8 B | −0.0% |

### bare-expo-preset/ios/expo → bare-expo-preset/ios/expo-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 846.8 KiB | 754.3 KiB | −92.5 KiB | −10.9% |
| Gzip | 208.2 KiB | 190.2 KiB | −17.9 KiB | −8.6% |
| Brotli | 170.9 KiB | 157.4 KiB | −13.5 KiB | −7.9% |
| Hermes bytecode | 1.24 MiB | 1.12 MiB | −124.3 KiB | −9.8% |
| Modules | 510 | 409 | −101 | −19.8% |

### Biggest package changes (top 3 of 3)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 592.2 KiB | 518.3 KiB | −73.8 KiB | −12.5% |
| (unmapped) | 79.6 KiB | 62.0 KiB | −17.6 KiB | −22.1% |
| flow-enums-runtime | 1.1 KiB | 0 B | −1.1 KiB | −100.0% |

### bare-expo-preset/ios/expo → bare-expo-preset/ios/expo-shaker

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 846.8 KiB | 734.2 KiB | −112.6 KiB | −13.3% |
| Gzip | 208.2 KiB | 188.2 KiB | −20.0 KiB | −9.6% |
| Brotli | 170.9 KiB | 156.0 KiB | −14.9 KiB | −8.7% |
| Hermes bytecode | 1.24 MiB | 1.09 MiB | −152.9 KiB | −12.1% |
| Modules | 510 | 404 | −106 | −20.8% |

### Biggest package changes (top 8 of 8)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 592.2 KiB | 504.8 KiB | −87.4 KiB | −14.8% |
| (unmapped) | 79.6 KiB | 61.1 KiB | −18.5 KiB | −23.2% |
| react-native-safe-area-context | 4.4 KiB | 1.7 KiB | −2.6 KiB | −60.3% |
| react | 8.0 KiB | 5.3 KiB | −2.6 KiB | −33.0% |
| flow-enums-runtime | 1.1 KiB | 0 B | −1.1 KiB | −100.0% |
| scheduler | 3.9 KiB | 3.6 KiB | −259 B | −6.5% |
| @react-native/virtualized-lists | 48.7 KiB | 48.7 KiB | −75 B | −0.2% |
| base64-js | 1.4 KiB | 1.3 KiB | −70 B | −5.0% |

### bare-expo-preset/ios/expo → bare-expo-preset/ios/expo-tree-shaking-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 846.8 KiB | 822.1 KiB | −24.7 KiB | −2.9% |
| Gzip | 208.2 KiB | 205.0 KiB | −3.1 KiB | −1.5% |
| Brotli | 170.9 KiB | 168.8 KiB | −2.2 KiB | −1.3% |
| Hermes bytecode | 1.24 MiB | 1.20 MiB | −35.1 KiB | −2.8% |
| Modules | 510 | 481 | −29 | −5.7% |

### Biggest package changes (top 5 of 5)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 592.2 KiB | 575.8 KiB | −16.4 KiB | −2.8% |
| (unmapped) | 79.6 KiB | 73.6 KiB | −6.0 KiB | −7.6% |
| react-native-safe-area-context | 4.4 KiB | 2.0 KiB | −2.3 KiB | −53.2% |
| @react-native/new-app-screen | 5.1 KiB | 5.1 KiB | −20 B | −0.4% |
| @react-native/virtualized-lists | 48.7 KiB | 48.7 KiB | −8 B | −0.0% |

## bare-expo-preset (android)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 851.2 KiB | 209.6 KiB | 172.1 KiB | 1271.2 KiB | 508 | 4.4 s |
| expo-tree-shaking | 828.8 KiB | 206.8 KiB | 170.4 KiB | 1237.8 KiB | 482 | 8.4 s |
| expo-getters | 757.8 KiB | 191.2 KiB | 158.3 KiB | 1146.1 KiB | 410 | 1.1 s |
| expo-shaker | 739.1 KiB | 189.3 KiB | 156.8 KiB | 1118.5 KiB | 405 | 1.9 s |
| expo-tree-shaking-getters | 828.8 KiB | 206.8 KiB | 170.3 KiB | 1237.8 KiB | 482 | 5.4 s |

### bare-expo-preset/android/expo → bare-expo-preset/android/expo-tree-shaking

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 851.2 KiB | 828.8 KiB | −22.4 KiB | −2.6% |
| Gzip | 209.6 KiB | 206.8 KiB | −2.7 KiB | −1.3% |
| Brotli | 172.1 KiB | 170.4 KiB | −1.7 KiB | −1.0% |
| Hermes bytecode | 1.24 MiB | 1.21 MiB | −33.4 KiB | −2.6% |
| Modules | 508 | 482 | −26 | −5.1% |

### Biggest package changes (top 5 of 5)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 596.2 KiB | 581.7 KiB | −14.4 KiB | −2.4% |
| (unmapped) | 79.9 KiB | 74.4 KiB | −5.6 KiB | −7.0% |
| react-native-safe-area-context | 4.4 KiB | 2.0 KiB | −2.3 KiB | −53.2% |
| @react-native/new-app-screen | 5.1 KiB | 5.1 KiB | −20 B | −0.4% |
| @react-native/virtualized-lists | 48.7 KiB | 48.7 KiB | −8 B | −0.0% |

### bare-expo-preset/android/expo → bare-expo-preset/android/expo-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 851.2 KiB | 757.8 KiB | −93.3 KiB | −11.0% |
| Gzip | 209.6 KiB | 191.2 KiB | −18.4 KiB | −8.8% |
| Brotli | 172.1 KiB | 158.3 KiB | −13.7 KiB | −8.0% |
| Hermes bytecode | 1.24 MiB | 1.12 MiB | −125.1 KiB | −9.8% |
| Modules | 508 | 410 | −98 | −19.3% |

### Biggest package changes (top 3 of 3)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 596.2 KiB | 521.5 KiB | −74.6 KiB | −12.5% |
| (unmapped) | 79.9 KiB | 62.3 KiB | −17.6 KiB | −22.0% |
| flow-enums-runtime | 1.1 KiB | 0 B | −1.1 KiB | −100.0% |

### bare-expo-preset/android/expo → bare-expo-preset/android/expo-shaker

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 851.2 KiB | 739.1 KiB | −112.1 KiB | −13.2% |
| Gzip | 209.6 KiB | 189.3 KiB | −20.2 KiB | −9.7% |
| Brotli | 172.1 KiB | 156.8 KiB | −15.2 KiB | −8.9% |
| Hermes bytecode | 1.24 MiB | 1.09 MiB | −152.7 KiB | −12.0% |
| Modules | 508 | 405 | −103 | −20.3% |

### Biggest package changes (top 8 of 8)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 596.2 KiB | 509.3 KiB | −86.9 KiB | −14.6% |
| (unmapped) | 79.9 KiB | 61.4 KiB | −18.5 KiB | −23.1% |
| react-native-safe-area-context | 4.4 KiB | 1.7 KiB | −2.6 KiB | −60.3% |
| react | 8.0 KiB | 5.3 KiB | −2.6 KiB | −33.0% |
| flow-enums-runtime | 1.1 KiB | 0 B | −1.1 KiB | −100.0% |
| scheduler | 3.9 KiB | 3.6 KiB | −259 B | −6.5% |
| @react-native/virtualized-lists | 48.7 KiB | 48.7 KiB | −75 B | −0.2% |
| base64-js | 1.4 KiB | 1.3 KiB | −70 B | −5.0% |

### bare-expo-preset/android/expo → bare-expo-preset/android/expo-tree-shaking-getters

| Metric | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| Raw | 851.2 KiB | 828.8 KiB | −22.3 KiB | −2.6% |
| Gzip | 209.6 KiB | 206.8 KiB | −2.7 KiB | −1.3% |
| Brotli | 172.1 KiB | 170.3 KiB | −1.8 KiB | −1.1% |
| Hermes bytecode | 1.24 MiB | 1.21 MiB | −33.4 KiB | −2.6% |
| Modules | 508 | 482 | −26 | −5.1% |

### Biggest package changes (top 5 of 5)

| Package | Base | Head | Change | % |
| --- | ---: | ---: | ---: | ---: |
| react-native | 596.2 KiB | 581.7 KiB | −14.4 KiB | −2.4% |
| (unmapped) | 79.9 KiB | 74.4 KiB | −5.5 KiB | −6.9% |
| react-native-safe-area-context | 4.4 KiB | 2.0 KiB | −2.3 KiB | −53.2% |
| @react-native/new-app-screen | 5.1 KiB | 5.1 KiB | −20 B | −0.4% |
| @react-native/virtualized-lists | 48.7 KiB | 48.7 KiB | −8 B | −0.0% |
