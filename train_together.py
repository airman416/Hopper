from together import Together

# Swap in your Together API key
client = Together(api_key="tgp_v1_hSbySTzVsXW-2rnxrSVUmBup6ILpwEGBN-YdICkKTjk")

print("Uploading dataset to Together AI...")
file_resp = client.files.upload(file="training_data_together.jsonl")
print(f"Dataset uploaded! File ID: {file_resp.id}")

print("Triggering Llama 4 Maverick training cluster...")
job = client.fine_tuning.create(
    model="meta-llama/Llama-4-Maverick-17B-128E-Instruct",
    training_file=file_resp.id,
    n_epochs=3,
    lora=True
)

print(f"Success! Job ID: {job.id}")