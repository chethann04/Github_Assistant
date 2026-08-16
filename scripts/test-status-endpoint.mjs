import axios from 'axios';

async function testStatus() {
  const jobId = '2a4f6628-3953-4501-a9a8-ae322d6cbaf2';
  console.log(`Sending GET request to http://localhost:4000/api/v1/indexing/status/${jobId}`);

  try {
    const res = await axios.get(`http://localhost:4000/api/v1/indexing/status/${jobId}`);
    console.log('Status code:', res.status);
    console.log('Response data:', res.data);
  } catch (err) {
    console.error('Request failed:');
    console.error('Status:', err.response?.status);
    console.error('Data:', err.response?.data);
    console.error('Message:', err.message);
  }
}

testStatus();
