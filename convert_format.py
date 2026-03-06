import json

print("Converting dataset format for Together AI...")

with open("training_data.jsonl", "r") as infile, open("training_data_together.jsonl", "w") as outfile:
    for line in infile:
        data = json.loads(line)
        
        # Transform into the Together AI / OpenAI Messages format
        together_format = {
            "messages": [
                {"role": "user", "content": data["instruction"]},
                {"role": "assistant", "content": data["output"]}
            ]
        }
        
        outfile.write(json.dumps(together_format) + "\n")

print("Done! Saved as training_data_together.jsonl")