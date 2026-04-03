// ==================== CẤU HÌNH GROQ API ====================
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_API_KEY = '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';

let apiKey = DEFAULT_API_KEY;
let currentQuestions = [];

// ==================== QUẢN LÝ DỮ LIỆU ====================
let userData = {
    highScore: 0,
    totalQuizzes: 0,
    history: [],
    savedGrade: '5',
    savedTopic: 'all'
};

function loadUserData() {
    const saved = localStorage.getItem('mathLearningData');
    if (saved) {
        userData = JSON.parse(saved);
        updateStatsDisplay();
        renderHistory();
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

function updateStatsDisplay() {
    const highScoreEl = document.getElementById('highScore');
    const totalEl = document.getElementById('totalQuizzes');
    if (highScoreEl) highScoreEl.textContent = userData.highScore;
    if (totalEl) totalEl.textContent = userData.totalQuizzes;
}

function saveUserData() {
    localStorage.setItem('mathLearningData', JSON.stringify(userData));
}

function addToHistory(score, total, grade, topic) {
    userData.history.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        score: score,
        total: total,
        grade: grade,
        topic: topic
    });
    
    // Chỉ giữ 50 bài gần nhất
    if (userData.history.length > 50) {
        userData.history.pop();
    }
    
    if (score > userData.highScore) {
        userData.highScore = score;
    }
    userData.totalQuizzes++;
    
    saveUserData();
    updateStatsDisplay();
    renderHistory();
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    if (userData.history.length === 0) {
        historyList.innerHTML = '<div class="empty-history">Chưa có bài làm nào</div>';
        return;
    }
    
    historyList.innerHTML = userData.history.map(item => {
        const date = new Date(item.date);
        const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        const percent = (item.score / item.total) * 100;
        let scoreClass = 'bad';
        if (percent >= 80) scoreClass = 'good';
        else if (percent >= 50) scoreClass = 'medium';
        
        return `
            <div class="history-item">
                <div class="history-date">${formattedDate}</div>
                <div class="history-grade">Lớp ${item.grade} - ${item.topic === 'all' ? 'Toán' : item.topic}</div>
                <div class="history-score ${scoreClass}">${item.score}/${item.total}</div>
            </div>
        `;
    }).join('');
}

function toggleHistory() {
    const historyList = document.getElementById('historyList');
    const icon = document.getElementById('historyToggleIcon');
    if (historyList.classList.contains('show')) {
        historyList.classList.remove('show');
        icon.style.transform = 'rotate(0deg)';
    } else {
        historyList.classList.add('show');
        icon.style.transform = 'rotate(180deg)';
    }
}

// ==================== GỌI GROQ API ====================
async function callGroqAPI(prompt) {
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
                    temperature: 0.7,
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
        }
    }

    throw lastError || new Error('Không có model nào hoạt động');
}

// ==================== TẠO CÂU HỎI ====================
async function generateQuestionsWithAI(grade, topic, count = 10) {
    const gradeNum = parseInt(grade);
    let difficulty = '';
    if (gradeNum <= 5) difficulty = `học sinh tiểu học lớp ${grade}`;
    else if (gradeNum <= 9) difficulty = `học sinh THCS lớp ${grade}`;
    else difficulty = `học sinh THPT lớp ${grade}`;
    
    const topicDesc = topic === 'all' ? 'toán tổng hợp' : `toán - chủ đề ${topic}`;

    const prompt = `Bạn là giáo viên toán. Hãy tạo CHÍNH XÁC ${count} câu hỏi trắc nghiệm cho ${difficulty}, chủ đề ${topicDesc}.

QUAN TRỌNG:
- Câu hỏi KHÔNG cần hình ảnh, chỉ dùng văn bản
- Câu hình học: mô tả bằng lời, không cần hình vẽ
- Đáp án phải CHÍNH XÁC về mặt toán học
- Giải thích phải RÕ RÀNG, có công thức

Mỗi câu hỏi có dạng JSON CHUẨN:
{
    "text": "nội dung câu hỏi",
    "options": ["đáp án A", "đáp án B", "đáp án C", "đáp án D"],
    "correct": 0,
    "explanation": "giải thích chi tiết (có công thức nếu cần)"
}

Yêu cầu:
- Đáp án đúng là index (0,1,2,3)
- 4 đáp án phải khác nhau
- Giải thích phải giúp học sinh hiểu cách làm

TRẢ VỀ JSON array, KHÔNG có text nào khác.`;

    const responseText = await callGroqAPI(prompt);
    
    // Tìm JSON array
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
        throw new Error('Không thể parse JSON từ AI. Vui lòng thử lại.');
    }
    
    const questions = JSON.parse(jsonMatch[0]);
    
    if (!questions || questions.length !== count) {
        throw new Error(`AI chỉ tạo được ${questions?.length || 0}/${count} câu hỏi`);
    }
    
    // Chuẩn hóa dữ liệu
    for (let i = 0; i < questions.length; i++) {
        if (!questions[i].options || questions[i].options.length < 4) {
            questions[i].options = ["A", "B", "C", "D"];
        }
        if (typeof questions[i].correct !== 'number' || questions[i].correct < 0 || questions[i].correct > 3) {
            questions[i].correct = 0;
        }
        if (!questions[i].explanation) {
            questions[i].explanation = "Giải thích: " + questions[i].text;
        }
    }
    
    return questions;
}

// ==================== LẤY CÂU HỎI ====================
let questionsCache = {};

async function getQuestions(grade, topic, count = 10, forceRefresh = false) {
    const today = new Date().toDateString();
    const cacheKey = `${grade}_${topic}_${today}`;
    
    if (!forceRefresh && questionsCache[cacheKey]) {
        return questionsCache[cacheKey];
    }

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
    errorDiv.style.cssText = 'background: #fef2f2; color: #dc2626; padding: 40px; border-radius: 24px; text-align: center;';
    
    let errorMessage = error.message;
    let suggestion = '';

    if (errorMessage.includes('Rate limit')) {
        suggestion = 'Bạn đã dùng hết giới hạn tốc độ. Vui lòng thử lại sau 1 phút.';
    } else if (errorMessage.includes('API key')) {
        suggestion = 'API Key không hợp lệ. Vui lòng liên hệ admin để cập nhật key mới.';
    } else {
        suggestion = errorMessage;
    }

    errorDiv.innerHTML = `
        <i class="fas fa-circle-exclamation" style="font-size: 48px; margin-bottom: 20px;"></i>
        <h3 style="margin-bottom: 12px;">⚠️ Không thể tải câu hỏi</h3>
        <p style="color: #64748b; margin-bottom: 24px;">${suggestion}</p>
        <button id="retryBtn" class="btn-primary">🔄 Thử lại</button>
    `;
    
    container.appendChild(errorDiv);

    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) retryBtn.onclick = () => loadNewQuestions(true);
}

// ==================== HIỂN THỊ CÂU HỎI ====================
function displayQuestions(questions) {
    currentQuestions = questions;
    const container = document.getElementById('quizContainer');
    container.innerHTML = '';
    
    const grade = document.getElementById('grade').value;
    const topicName = document.getElementById('topic').value === 'all' ? 'Toán' : document.getElementById('topic').value;
    
    const header = document.createElement('div');
    header.style.cssText = 'background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); padding: 16px 20px; border-radius: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;';
    header.innerHTML = `
        <span><i class="fas fa-graduation-cap"></i> Lớp ${grade} - ${topicName}</span>
        <span><i class="fas fa-list"></i> 10 câu hỏi</span>
    `;
    container.appendChild(header);

    questions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.innerHTML = `
            <div class="question-text">
                <span style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 4px 12px; border-radius: 20px; font-size: 13px; margin-right: 12px;">${idx+1}</span>
                ${q.text}
            </div>
            <div class="options">
                ${q.options.map((opt, i) => `
                    <label class="option">
                        <input type="radio" name="q${idx}" value="${i}">
                        <span style="font-weight: 600; min-width: 28px;">${String.fromCharCode(65+i)}.</span>
                        <span>${opt}</span>
                    </label>
                `).join('')}
            </div>
        `;
        container.appendChild(card);
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-submit';
    submitBtn.style.cssText = 'width: 100%; margin-top: 20px; justify-content: center;';
    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Nộp bài và xem kết quả';
    submitBtn.onclick = submitQuiz;
    container.appendChild(submitBtn);
    
    document.getElementById('resultContainer').style.display = 'none';
}

function showLoading(show) {
    const container = document.getElementById('quizContainer');
    if (show) {
        container.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <h3 style="margin-top: 16px;">🤖 AI đang tạo câu hỏi...</h3>
                <p style="color: #64748b; margin-top: 8px;">Vui lòng chờ trong giây lát</p>
            </div>
        `;
    }
}

// ==================== CHẤM ĐIỂM ====================
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

    // Lưu vào lịch sử
    const grade = document.getElementById('grade').value;
    const topic = document.getElementById('topic').value;
    addToHistory(score, currentQuestions.length, grade, topic);

    document.getElementById('scoreNumber').textContent = score;
    const percentage = (score / 10) * 100;
    document.getElementById('progressFill').style.width = `${percentage}%`;

    let expanded = false;
    const detailsDiv = document.getElementById('detailedAnswers');
    
    document.getElementById('reviewBtn').onclick = () => {
        if (expanded) {
            detailsDiv.innerHTML = '';
            expanded = false;
        } else {
            detailsDiv.innerHTML = answers.map((ans, i) => `
                <div class="detailed-answer ${ans.isCorrect ? 'correct' : 'wrong'}">
                    <div style="font-weight: 700; margin-bottom: 12px;">Câu ${i+1}: ${ans.question}</div>
                    <div><i class="fas fa-user-edit"></i> Câu trả lời của bạn: ${ans.userAnswer}</div>
                    <div><i class="fas fa-check-circle"></i> Đáp án đúng: ${ans.correctAnswer}</div>
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.05);"><i class="fas fa-lightbulb"></i> ${ans.explanation}</div>
                </div>
            `).join('');
            expanded = true;
        }
    };
    
    document.getElementById('newQuizBtn').onclick = () => {
        document.getElementById('resultContainer').style.display = 'none';
        loadNewQuestions();
    };
    
    document.getElementById('resultContainer').style.display = 'block';
    document.getElementById('resultContainer').scrollIntoView({ behavior: 'smooth' });
}

// ==================== TẢI CÂU HỎI MỚI ====================
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

// ==================== KHỞI TẠO ====================
document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    
    const gradeSelect = document.getElementById('grade');
    const topicSelect = document.getElementById('topic');
    const newBtn = document.getElementById('newQuestionsBtn');
    const startBtn = document.getElementById('startBtn');

    if (gradeSelect) gradeSelect.onchange = () => { saveSelectedOptions(); loadNewQuestions(); };
    if (topicSelect) topicSelect.onchange = () => { saveSelectedOptions(); loadNewQuestions(); };
    if (newBtn) newBtn.onclick = () => loadNewQuestions(true);
    if (startBtn) startBtn.onclick = () => loadNewQuestions();

    // Gán hàm toggleHistory ra global để inline onclick hoạt động
    window.toggleHistory = toggleHistory;
    
    loadNewQuestions();
});