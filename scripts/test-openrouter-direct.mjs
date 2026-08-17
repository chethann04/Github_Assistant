import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testOpenRouter() {
  console.log('Testing OpenRouter models...');
  try {
    const res = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      timeout: 10000,
    });
    const glmModels = res.data.data.filter(m => m.id.toLowerCase().includes('glm') || m.id.toLowerCase().includes('z-ai'));
    console.log('Found GLM/Z-AI models on OpenRouter:');
    glmModels.forEach(m => console.log(` - ${m.id} (${m.name})`));
  } catch (err) {
    console.error('OpenRouter Models Fetch Error:', err.response?.status, err.response?.data || err.message);
  }
}

testOpenRouter();
