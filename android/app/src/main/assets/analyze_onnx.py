import onnx
from onnx import numpy_helper

# 1️⃣ 모델 로드
model_path = "C:/Users/bogyeong/LowLightCamera/LowLightCamera/android/app/src/main/assets/iat.onnx"
model = onnx.load(model_path)

# 2️⃣ 기본 정보 출력
print("=== 모델 기본 정보 ===")
print(f"Producer: {model.producer_name}")
print(f"Opset version: {model.opset_import[0].version}")
print(f"Input 개수: {len(model.graph.input)}")
print(f"Output 개수: {len(model.graph.output)}\n")

# 3️⃣ 입출력 이름, shape 확인
for i, inp in enumerate(model.graph.input):
    print(f"[Input {i}] {inp.name}")
    t = inp.type.tensor_type
    shape = [d.dim_value for d in t.shape.dim]
    print(f"  Shape: {shape}")

for i, out in enumerate(model.graph.output):
    print(f"[Output {i}] {out.name}")
    t = out.type.tensor_type
    shape = [d.dim_value for d in t.shape.dim]
    print(f"  Shape: {shape}")

# 4️⃣ 첫 10개 노드 구조 출력
print("\n=== 첫 10개 연산 ===")
for i, node in enumerate(model.graph.node[:10]):
    print(f"{i+1:02d}. {node.op_type}  ({', '.join(node.input)} → {', '.join(node.output)})")

# 5️⃣ 마지막 10개 연산 출력
print("\n=== 마지막 10개 연산 ===")
for i, node in enumerate(model.graph.node[-10:]):
    print(f"{i+1:02d}. {node.op_type}  ({', '.join(node.input)} → {', '.join(node.output)})")

# 6️⃣ Div, Pow, Clamp, Mul(255) 여부 검색 (전처리 흔적 탐지)
print("\n=== 전처리/후처리 흔적 탐색 ===")
keywords = ["Div", "Mul", "Pow", "Sub", "Add", "Clamp"]
for node in model.graph.node:
    if node.op_type in keywords:
        print(f"{node.op_type}: inputs={node.input}, outputs={node.output}")
