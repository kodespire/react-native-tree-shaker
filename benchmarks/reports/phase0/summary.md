# Benchmark results

## rn-template (ios)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| rn-cli | 865.1 KiB | 212.6 KiB | 168.6 KiB | 1227.3 KiB | 534 | 3.7 s |

## rn-template (android)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| rn-cli | 869.0 KiB | 214.2 KiB | 170.0 KiB | 1231.0 KiB | 530 | 3.8 s |

## expo-default (ios)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 2386.7 KiB | 555.6 KiB | 434.4 KiB | 3539.1 KiB | 1545 | 8.4 s |
| expo-tree-shaking | 2082.6 KiB | 504.9 KiB | 397.1 KiB | 3106.2 KiB | 1398 | 14.8 s |

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
| react-native-reanimated | 625.0 KiB | 396.2 KiB | −228.8 KiB | −36.6% |
| (unmapped) | 159.4 KiB | 136.3 KiB | −23.0 KiB | −14.5% |
| react-native | 593.9 KiB | 576.0 KiB | −17.9 KiB | −3.0% |
| semver | 17.6 KiB | 0 B | −17.6 KiB | −100.0% |
| react-native-worklets | 96.7 KiB | 91.0 KiB | −5.7 KiB | −5.9% |
| expo | 94.7 KiB | 91.6 KiB | −3.1 KiB | −3.3% |
| expo-modules-core | 14.7 KiB | 13.0 KiB | −1.7 KiB | −11.7% |
| expo-web-browser | 2.7 KiB | 1.2 KiB | −1.5 KiB | −54.9% |
| react-native-screens | 67.3 KiB | 65.9 KiB | −1.4 KiB | −2.1% |
| expo-image | 11.2 KiB | 9.9 KiB | −1.3 KiB | −11.4% |

## expo-default (android)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 2546.2 KiB | 602.6 KiB | 472.1 KiB | 3752.8 KiB | 1642 | 6.2 s |
| expo-tree-shaking | 2246.3 KiB | 553.0 KiB | 435.0 KiB | 3314.2 KiB | 1496 | 16.6 s |

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
| react-native-reanimated | 624.7 KiB | 396.1 KiB | −228.6 KiB | −36.6% |
| (unmapped) | 248.1 KiB | 225.8 KiB | −22.3 KiB | −9.0% |
| semver | 17.6 KiB | 0 B | −17.6 KiB | −100.0% |
| react-native | 598.0 KiB | 582.0 KiB | −16.0 KiB | −2.7% |
| expo-font | 9.8 KiB | 6.0 KiB | −3.8 KiB | −39.2% |
| expo | 94.9 KiB | 91.8 KiB | −3.1 KiB | −3.3% |
| expo-web-browser | 3.6 KiB | 1.3 KiB | −2.2 KiB | −62.2% |
| @expo/ui | 70.0 KiB | 71.9 KiB | +1.9 KiB | +2.8% |
| expo-modules-core | 14.9 KiB | 13.0 KiB | −1.9 KiB | −12.9% |
| react-native-worklets | 96.7 KiB | 94.8 KiB | −1.9 KiB | −2.0% |

## expo-barrels (ios)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 3449.1 KiB | 546.4 KiB | 422.3 KiB | 4537.8 KiB | 3587 | 8.1 s |
| expo-tree-shaking | 1144.6 KiB | 278.7 KiB | 226.3 KiB | 1750.5 KiB | 858 | 18.9 s |

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
| (unmapped) | 498.0 KiB | 123.3 KiB | −374.7 KiB | −75.2% |
| lodash-es | 243.0 KiB | 31.8 KiB | −211.3 KiB | −86.9% |
| date-fns | 161.7 KiB | 24.9 KiB | −136.8 KiB | −84.6% |
| react-native | 593.8 KiB | 575.9 KiB | −17.9 KiB | −3.0% |
| expo-modules-core | 14.7 KiB | 2.0 KiB | −12.7 KiB | −86.7% |
| react-native-svg | 107.3 KiB | 119.1 KiB | +11.8 KiB | +11.0% |
| expo | 91.3 KiB | 87.4 KiB | −3.9 KiB | −4.3% |
| expo-asset | 6.5 KiB | 5.6 KiB | −931 B | −13.9% |
| expo-status-bar | 1.1 KiB | 724 B | −421 B | −36.8% |

## expo-barrels (android)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 3454.4 KiB | 547.9 KiB | 423.7 KiB | 4543.4 KiB | 3586 | 7.0 s |
| expo-tree-shaking | 1152.1 KiB | 280.8 KiB | 228.0 KiB | 1757.9 KiB | 860 | 18.5 s |

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
| (unmapped) | 498.4 KiB | 124.1 KiB | −374.2 KiB | −75.1% |
| lodash-es | 243.0 KiB | 31.8 KiB | −211.3 KiB | −86.9% |
| date-fns | 161.7 KiB | 24.9 KiB | −136.8 KiB | −84.6% |
| react-native | 597.9 KiB | 581.9 KiB | −16.0 KiB | −2.7% |
| expo-modules-core | 14.9 KiB | 2.0 KiB | −13.0 KiB | −86.9% |
| react-native-svg | 107.7 KiB | 119.5 KiB | +11.8 KiB | +11.0% |
| expo | 91.5 KiB | 87.6 KiB | −3.9 KiB | −4.3% |
| expo-asset | 6.6 KiB | 5.7 KiB | −931 B | −13.7% |
| expo-status-bar | 1.1 KiB | 724 B | −421 B | −36.8% |

## bare-expo (ios)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 1519.3 KiB | 403.4 KiB | 301.1 KiB | 2198.1 KiB | 635 | 6.3 s |
| expo-tree-shaking | 1519.3 KiB | 403.4 KiB | 301.1 KiB | 2198.1 KiB | 635 | 13.2 s |

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

## bare-expo (android)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 1525.7 KiB | 404.3 KiB | 302.3 KiB | 2205.1 KiB | 639 | 6.0 s |
| expo-tree-shaking | 1525.7 KiB | 404.3 KiB | 302.3 KiB | 2205.1 KiB | 639 | 14.5 s |

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

## bare-expo-preset (ios)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 846.8 KiB | 208.2 KiB | 170.9 KiB | 1266.5 KiB | 510 | 4.2 s |
| expo-tree-shaking | 822.1 KiB | 205.0 KiB | 168.8 KiB | 1231.4 KiB | 481 | 7.3 s |

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
| react-native | 592.2 KiB | 574.5 KiB | −17.7 KiB | −3.0% |
| (unmapped) | 79.6 KiB | 74.9 KiB | −4.7 KiB | −5.9% |
| react-native-safe-area-context | 4.4 KiB | 2.0 KiB | −2.3 KiB | −53.2% |
| @react-native/new-app-screen | 5.1 KiB | 5.1 KiB | −20 B | −0.4% |
| @react-native/virtualized-lists | 48.7 KiB | 48.7 KiB | −8 B | −0.0% |

## bare-expo-preset (android)

| Variant | Raw | Gzip | Brotli | Hermes bytecode | Modules | Build time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| expo | 851.2 KiB | 209.6 KiB | 172.1 KiB | 1271.2 KiB | 508 | 3.2 s |
| expo-tree-shaking | 828.8 KiB | 206.8 KiB | 170.4 KiB | 1237.8 KiB | 482 | 7.9 s |

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
| react-native | 596.2 KiB | 580.4 KiB | −15.8 KiB | −2.6% |
| (unmapped) | 79.9 KiB | 75.7 KiB | −4.2 KiB | −5.3% |
| react-native-safe-area-context | 4.4 KiB | 2.0 KiB | −2.3 KiB | −53.2% |
| @react-native/new-app-screen | 5.1 KiB | 5.1 KiB | −20 B | −0.4% |
| @react-native/virtualized-lists | 48.7 KiB | 48.7 KiB | −8 B | −0.0% |
