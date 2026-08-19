# NPS V1 Color Scheme

| Signal | Color |
|---|---|
| Outdoor temperature | `#42A5F5` |
| Supply actual | `#EF6C3E` |
| Supply target | `#FBC02D` |
| Return | `#AB47BC` |
| Warm water top (BT7) | `#EC407A` |
| Warm-water charging (BT6) | `#FF9800` |
| Compressor frequency | `#26A69A` |
| Electrical power | `#5C6BC0` |
| Thermal power | `#FF7043` |
| COP total | `#66BB6A` |
| COP heating | `#43A047` |
| COP warm water | `#26A69A` |
| Compressor share | `#7CB342` |
| Auxiliary-heater share | `#E53935` |
| Defrost | `#FF8F00` |
| Cycle duration | `#42A5F5` |
| Cycle quality | `#66BB6A` |
| Degree minutes | `#7E57C2` |

`#C45A32` is reserved for active status indicators and is not a normal measurement-curve color.

## Boolean status

```json
{"true":{"color":"#C45A32"},"false":{"color":"#78909C"},"default":{"color":"grey"}}
```
