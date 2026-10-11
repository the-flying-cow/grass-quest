import spaces #import spaces first
import torch
import gradio as gr
from transformers import AutoTokenizer, AutoModelForCausalLM

model_id = "google/gemma-3-4b-it"

tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    dtype=torch.bfloat16,
)
model.to("cuda")

@spaces.GPU
def classify_reflection(reflection_text: str) -> str:
    messages = [
        {
            "role": "user",
            "content": f"""Analyze this outdoor observation reflection and classify it into EXACTLY ONE of these four elements:
            - Monsoon Water
            - Earthy Terra
            - Urban Flora
            - Solar Heat
            
            Reflection: "{reflection_text}"
    
            Return ONLY the exact element name from the list, with no extra text or punctuation."""
        }
    ]

    prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )

    inputs = tokenizer(prompt, return_tensors="pt", add_special_tokens=False).to("cuda")

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=15,
            do_sample=False
        )

    input_length = inputs.input_ids.shape[1]
    generated_tokens = outputs[0][input_length:]
    element = tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()

    return element

demo = gr.Interface(
    fn=classify_reflection,
    inputs=gr.Textbox(
        lines=2,
        placeholder="Enter your field reflection here...",
        label="Outdoor Reflection"
    ),
    outputs=gr.Textbox(
        label="Elemental Classification"
    ),
    title="GrassQuest Gemma Classifier",
    description="Classifies outdoor field notes into Monsoon Water, Earthy Terra, Urban Flora, or Solar Heat."
)

if __name__ == "__main__":
    demo.launch()