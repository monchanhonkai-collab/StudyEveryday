// ==================== DÙNG GROQ API (MIỄN PHÍ) ====================
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
let apiKey = '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';          // Sẽ lưu từ localStorage
let currentQuestions = [];

// ==================== QUẢN LÝ DỮ LIỆU NGƯỜI DÙNG ====================
let userData = {
    streak: 0,
    highScore: 0,
    totalQuizzes: 0,
    lastDate: null,
    history: [],
    savedGrade: '5',
    savedTopic: 'all'
};

function loadUserData() {
    const saved = localStorage.getItem('mathLearningData');
    if (saved) {
        userData = JSON.parse(saved);
        checkStreak();
        updateStreakDisplay();
    }
    
    // Lấy key từ localStorage, nếu chưa có thì dùng key mặc định
    const savedKey = localStorage.getItem('groqApiKey');
    if (savedKey) {
        apiKey = savedKey;
    } else {
        // Gán key mặc định và lưu lại
        apiKey = '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';
        localStorage.setItem('groqApiKey', apiKey);
    }
    
    if (userData.savedGrade) {
        const gradeSelect = document.getElementById('grade');
        if (gradeSelect) gradeSelect.value = userData.savedGrade;
    }
    if (userData.savedTopic) {
        const topicSelect = document.getElementById('topic');
        if (topicSelect) topicSelect.value = userData.savedTopic;
    }
}

function saveSelectedOptions() {
    const gradeSelect = document.getElementById('grade');
    const topicSelect = document.getElementById('topic');
    if (gradeSelect) userData.savedGrade = gradeSelect.value;
    if (topicSelect) userData.savedTopic = topicSelect.value;
    saveUserData();
}

function checkStreak() {
    const today = new Date().toDateString();
    if (userData.lastDate === today) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (userData.lastDate === yesterday.toDateString()) {
        userData.streak++;
    } else if (userData.lastDate !== today && userData.lastDate !== null) {
        userData.streak = 0;
    }
    userData.lastDate = today;
    saveUserData();
}

function updateStreakDisplay() {
    const streakEl = document.getElementById('streakDays');
    const highScoreEl = document.getElementById('highScore');
    const totalEl = document.getElementById('totalQuizzes');
    if (streakEl) streakEl.textContent = userData.streak;
    if (highScoreEl) highScoreEl.textContent = userData.highScore;
    if (totalEl) totalEl.textContent = userData.totalQuizzes;
}

function saveUserData() {
    localStorage.setItem('mathLearningData', JSON.stringify(userData));
}

function saveApiKey(key) {
    apiKey = key;
    localStorage.setItem('groqApiKey', key);
}

// ==================== GỌI GROQ API (CÓ THỬ NHIỀU MODEL) ====================
async function callGroqAPI(prompt) {
    if (!apiKey) {
        throw new Error('❌ Vui lòng cấu hình Groq API Key');
    }

    // Danh sách model thử theo thứ tự ưu tiên
    const modelsToTry = [
        'llama-3.1-8b-instant',
        'llama-3.3-70b-versatile',
        'mixtral-8x7b-32768'
    ];

    let lastError = null;

    for (const model of modelsToTry) {
        try {
            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.8,
                    max_tokens: 4096
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `Lỗi HTTP ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (err) {
            console.warn(`Model ${model} thất bại:`, err.message);
            lastError = err;
            // Tiếp tục thử model tiếp theo
        }
    }

    throw lastError || new Error('Không có model nào hoạt động');
}

// ==================== TẠO CÂU HỎI ====================
async function generateQuestionsWithAI(grade, topic, count = 10) {
    const gradeNum = parseInt(grade);
    let difficulty = '';
    if (gradeNum <= 5) difficulty = `học sinh tiểu học lớp ${grade} (nâng cao)`;
    else if (gradeNum <= 9) difficulty = `học sinh THCS lớp ${grade} (nâng cao)`;
    else difficulty = `học sinh THPT lớp ${grade} (khó)`;
    const topicDesc = topic === 'all' ? 'toán tổng hợp' : `toán - chủ đề ${topic}`;

    const prompt = `Bạn là giáo viên toán. Hãy tạo ${count} câu hỏi trắc nghiệm cho ${difficulty}, chủ đề ${topicDesc}.

Mỗi câu hỏi có dạng JSON:
{
    "text": "nội dung câu hỏi",
    "options": ["đáp án A", "đáp án B", "đáp án C", "đáp án D"],
    "correct": 0,
    "explanation": "giải thích chi tiết"
}

Yêu cầu:
- Đáp án đúng là số index (0,1,2,3)
- Câu hỏi phù hợp trình độ
- Giải thích rõ ràng

QUAN TRỌNG: Chỉ trả về JSON array, không có text nào khác.`;

    const responseText = await callGroqAPI(prompt);
    let jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
        const objectMatches = responseText.match(/\{[\s\S]*?\}/g);
        if (objectMatches && objectMatches.length >= count) {
            const questions = [];
            for (let i = 0; i < count && i < objectMatches.length; i++) {
                try {
                    const q = JSON.parse(objectMatches[i]);
                    if (q.text && q.options) questions.push(q);
                } catch(e) {}
            }
            if (questions.length === count) return questions;
        }
        throw new Error('Không parse được JSON từ AI');
    }
    const questions = JSON.parse(jsonMatch[0]);
    if (!questions || questions.length !== count) {
        throw new Error(`Chỉ nhận được ${questions?.length || 0}/${count} câu hỏi`);
    }
    // Chuẩn hóa
    for (let i = 0; i < questions.length; i++) {
        if (!questions[i].options || questions[i].options.length < 4) {
            questions[i].options = ["A", "B", "C", "D"];
        }
        if (typeof questions[i].correct !== 'number') questions[i].correct = 0;
        if (!questions[i].explanation) questions[i].explanation = "Giải thích chi tiết";
    }
    return questions;
}

// ==================== LẤY CÂU HỎI (KHÔNG FALLBACK) ====================
let questionsCache = {};

async function getQuestions(grade, topic, count = 10, forceRefresh = false) {
    const today = new Date().toDateString();
    const cacheKey = `${grade}_${topic}_${today}`;
    if (!forceRefresh && questionsCache[cacheKey]) return questionsCache[cacheKey];

    showLoading(true);
    try {
        const questions = await generateQuestionsWithAI(grade, topic, count);
        questionsCache[cacheKey] = questions;
        showLoading(false);
        return questions;
    } catch (error) {
        console.error('AI Error:', error);
        showLoading(false);
        throw error;
    }
}

// ==================== HIỂN THỊ THÔNG BÁO LỖI ====================
function showErrorMessage(error) {
    const container = document.getElementById('quizContainer');
    container.innerHTML = '';

    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'background: #fff3cd; color: #856404; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center; border: 1px solid #ffeeba;';
    
    let errorMessage = error.message;
    let suggestion = '';

    if (errorMessage.includes('Rate limit') || errorMessage.includes('tokens per minute')) {
        suggestion = `
            <p>📊 Bạn đã dùng hết giới hạn tốc độ (rate limit) của Groq. Hãy thử lại sau vài giây hoặc nâng cấp lên gói Dev Tier để tăng giới hạn.</p>
            <p><a href="https://console.groq.com/settings/billing" target="_blank">🔗 Nâng cấp tại đây</a></p>
            <p>💡 Hoặc bạn có thể <strong>tự thêm fallback câu hỏi mẫu</strong> vào code nếu muốn.</p>
        `;
    } else if (errorMessage.includes('API key') || errorMessage.includes('authorization') || errorMessage.includes('Invalid API Key')) {
        suggestion = `
            <p>🔑 API Key không hợp lệ. Vui lòng kiểm tra lại key hoặc cấu hình key mới.</p>
            <p>👉 <button id="configApiBtn" class="btn-primary">Cấu hình API Key</button></p>
        `;
    } else if (errorMessage.includes('model') && errorMessage.includes('not found')) {
        suggestion = `
            <p>🧠 Model AI không tồn tại hoặc đã bị thay thế. Hãy kiểm tra lại model trong code.</p>
            <p>👉 Thử model mới nhất tại <a href="https://console.groq.com/docs/models" target="_blank">Groq Models</a></p>
        `;
    } else {
        suggestion = `
            <p>⚠️ ${errorMessage}</p>
            <p>👉 Hãy thử lại sau, hoặc kiểm tra kết nối mạng.</p>
        `;
    }

    errorDiv.innerHTML = `
        <h3 style="margin: 0 0 10px 0;">⚠️ Không thể tải câu hỏi từ AI</h3>
        ${suggestion}
        <button id="retryBtn" class="btn-primary" style="margin-top: 15px;">🔄 Thử lại</button>
    `;
    
    container.appendChild(errorDiv);

    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) retryBtn.onclick = () => loadNewQuestions(true);

    const configBtn = document.getElementById('configApiBtn');
    if (configBtn) configBtn.onclick = showApiModal;
}

// ==================== HIỂN THỊ CÂU HỎI ====================
function displayQuestions(questions) {
    currentQuestions = questions;
    const container = document.getElementById('quizContainer');
    container.innerHTML = '';
    const today = new Date().toLocaleDateString('vi-VN');
    const grade = document.getElementById('grade').value;
    const topicName = document.getElementById('topic').value === 'all' ? 'Toán' : document.getElementById('topic').value;
    const header = document.createElement('div');
    header.style.cssText = 'background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;';
    header.innerHTML = `📅 ${today} | 🎓 Lớp ${grade} - ${topicName} | 🔥 Chuỗi: ${userData.streak} ngày | ⭐ Điểm cao: ${userData.highScore}/10`;
    container.appendChild(header);

    questions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.style.cssText = 'background: #f8f9fa; border-radius: 12px; padding: 18px; margin-bottom: 15px; border-left: 4px solid #667eea;';
        card.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 12px;"><span style="background: #667eea; color: white; padding: 2px 10px; border-radius: 20px; margin-right: 10px;">${idx+1}</span> ${q.text}</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${q.options.map((opt, i) => `
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="radio" name="q${idx}" value="${i}">
                        <span>${String.fromCharCode(65+i)}. ${opt}</span>
                    </label>
                `).join('')}
            </div>
        `;
        container.appendChild(card);
    });

    const submitBtn = document.createElement('button');
    submitBtn.textContent = '📝 Nộp bài';
    submitBtn.style.cssText = 'background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 14px; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 20px;';
    submitBtn.onclick = submitQuiz;
    container.appendChild(submitBtn);
    document.getElementById('resultContainer').style.display = 'none';
}

function showLoading(show) {
    const container = document.getElementById('quizContainer');
    if (show) {
        container.innerHTML = `<div style="text-align: center; padding: 50px;"><div style="width: 50px; height: 50px; border: 4px solid #e2e8f0; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div><h3>🤖 AI đang tạo câu hỏi...</h3><style>@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360)}}</style></div>`;
    }
}

function submitQuiz() {
    let score = 0;
    const answers = [];
    currentQuestions.forEach((q, idx) => {
        const selected = document.querySelector(`input[name="q${idx}"]:checked`);
        const isCorrect = selected && parseInt(selected.value) === q.correct;
        if (isCorrect) score++;
        answers.push({
            question: q.text,
            userAnswer: selected ? q.options[parseInt(selected.value)] : 'Chưa trả lời',
            correctAnswer: q.options[q.correct],
            isCorrect: isCorrect,
            explanation: q.explanation
        });
    });

    if (score > userData.highScore) userData.highScore = score;
    userData.totalQuizzes++;
    saveUserData();
    updateStreakDisplay();

    document.getElementById('scoreNumber').textContent = score;
    document.getElementById('progressFill').style.width = `${(score/10)*100}%`;

    let expanded = false;
    const detailsDiv = document.getElementById('detailedAnswers');
    document.getElementById('reviewBtn').onclick = () => {
        if (expanded) {
            detailsDiv.innerHTML = '';
            expanded = false;
        } else {
            answers.forEach((ans, i) => {
                const div = document.createElement('div');
                div.style.cssText = `background: ${ans.isCorrect ? '#e6fffa' : '#fff5f5'}; padding: 12px; margin: 10px 0; border-radius: 8px; border-left: 4px solid ${ans.isCorrect ? '#48bb78' : '#f56565'};`;
                div.innerHTML = `<strong>Câu ${i+1}:</strong> ${ans.question}<br>📝 Bạn: ${ans.userAnswer}<br>✅ Đáp án: ${ans.correctAnswer}<br>💡 ${ans.explanation}`;
                detailsDiv.appendChild(div);
            });
            expanded = true;
        }
    };
    document.getElementById('newQuizBtn').onclick = () => {
        document.getElementById('resultContainer').style.display = 'none';
        loadNewQuestions();
    };
    document.getElementById('resultContainer').style.display = 'block';
}

let isLoading = false;
async function loadNewQuestions(forceRefresh = false) {
    if (isLoading) return;
    isLoading = true;
    saveSelectedOptions();
    try {
        const grade = document.getElementById('grade').value;
        const topic = document.getElementById('topic').value;
        const questions = await getQuestions(grade, topic, 10, forceRefresh);
        displayQuestions(questions);
    } catch (error) {
        console.error('Error loading questions:', error);
        showErrorMessage(error);
    } finally {
        isLoading = false;
    }
}

// ==================== MODAL API ====================
function showApiModal() {
    let modal = document.getElementById('apiConfigModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'apiConfigModal';
        modal.style.cssText = `position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;`;
        modal.innerHTML = `
            <div style="background: white; border-radius: 20px; max-width: 500px; width: 90%; padding: 30px;">
                <span id="closeModalBtn" style="float: right; font-size: 28px; cursor: pointer;">&times;</span>
                <h2>🔑 Cấu hình Groq API</h2>
                <p><strong>Groq</strong> cung cấp model AI miễn phí, nhanh. Lấy key tại:</p>
                <p><a href="https://console.groq.com/keys" target="_blank">https://console.groq.com/keys</a></p>
                <p>Đăng ký bằng Google, tạo key, dán vào đây:</p>
                <input type="text" id="apiKeyInput" placeholder="Dán Groq API Key" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; margin: 10px 0;">
                <button id="saveApiKeyBtn" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">💾 Lưu và sử dụng</button>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('closeModalBtn').onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }
    modal.style.display = 'flex';
    document.getElementById('apiKeyInput').value = apiKey;
    document.getElementById('saveApiKeyBtn').onclick = () => {
        const newKey = document.getElementById('apiKeyInput').value.trim();
        if (newKey) {
            saveApiKey(newKey);
            modal.style.display = 'none';
            alert('✅ Đã lưu Groq API Key! Đang tải câu hỏi...');
            loadNewQuestions(true);
        } else {
            alert('Vui lòng nhập API Key');
        }
    };
}

// ==================== KHỞI TẠO ====================
document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    const gradeSelect = document.getElementById('grade');
    const topicSelect = document.getElementById('topic');
    const newBtn = document.getElementById('newQuestionsBtn');
    const refreshApiBtn = document.getElementById('refreshApiBtn');
    const startBtn = document.getElementById('startBtn');

    if (gradeSelect) gradeSelect.onchange = () => { saveSelectedOptions(); loadNewQuestions(); };
    if (topicSelect) topicSelect.onchange = () => { saveSelectedOptions(); loadNewQuestions(); };
    if (newBtn) newBtn.onclick = () => loadNewQuestions(true);
    if (refreshApiBtn) refreshApiBtn.onclick = showApiModal;
    if (startBtn) startBtn.onclick = () => loadNewQuestions();

    // Luôn chạy loadNewQuestions (không confirm, vì đã có key)
    loadNewQuestions();
});