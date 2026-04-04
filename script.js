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
    
    if (userData.history.length > 50) userData.history.pop();
    if (score > userData.highScore) userData.highScore = score;
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
        const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        const percent = (item.score / item.total) * 100;
        let scoreClass = 'bad';
        if (percent >= 80) scoreClass = 'good';
        else if (percent >= 50) scoreClass = 'medium';
        
        return `
            <div class="history-item">
                <div class="history-date">${formattedDate}</div>
                <div class="history-grade">Lớp ${item.grade}</div>
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
    const modelsToTry = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];
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
                    temperature: 0.3,
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

// ==================== TẠO CÂU HỎI (CHỈ DÙNG AI) ====================
async function generateQuestionsWithAI(grade, topic, count = 10) {
    const gradeNum = parseInt(grade);
    const topicText = topic === 'all' ? 'toán học' : topic;
    
const prompt = `Bạn là giáo viên toán lớp ${grade} theo chương trình "Kết nối tri thức với cuộc sống". Hãy tạo ${count} câu hỏi trắc nghiệm toán phù hợp với học sinh lớp ${grade} ở mức độ khả năng lực học trung bình trở lên, chủ đề "${topicText}", nhưng đảm bảo câu hỏi không bị quá dễ, quá cơ bản.

Yêu cầu:
- Nội dung CHÍNH XÁC theo sách Kết nối tri thức với cuộc sống lớp ${grade}
- Dạng bài tập: tính toán, giải phương trình, hình học, thực tế...
- Mỗi câu có đáp số là số cụ thể
- Giải thích ngắn gọn theo phương pháp của bộ sách này

Định dạng JSON:
[
    {
        "text": "câu hỏi",
        "answer": đáp_số,
        "explanation": "giải thích"
    }
]

Chỉ trả về JSON array, không thêm text nào khác.`;

    try {
        const responseText = await callGroqAPI(prompt);
        const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
            const questions = JSON.parse(jsonMatch[0]);
            if (questions.length === count && questions.every(q => q.text && typeof q.answer === 'number')) {
                return questions;
            }
        }
        throw new Error('AI trả về định dạng không hợp lệ');
    } catch (error) {
        console.error('AI generation failed:', error);
        throw new Error('Không thể tạo câu hỏi từ AI. Vui lòng thử lại sau.');
    }
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
        console.error('Error:', error);
        showLoading(false);
        throw error;
    }
}

// ==================== HIỂN THỊ CÂU HỎI (DẠNG NHẬP ĐÁP ÁN) ====================
function displayQuestions(questions) {
    currentQuestions = questions;
    const container = document.getElementById('quizContainer');
    container.innerHTML = '';
    
    const grade = document.getElementById('grade').value;
    const topicName = document.getElementById('topic').value === 'all' ? 'Toán' : document.getElementById('topic').value;
    
    const infoBar = document.createElement('div');
    infoBar.style.cssText = 'background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; padding: 12px 20px; border-radius: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;';
    infoBar.innerHTML = `
        <span><i class="fas fa-graduation-cap"></i> Lớp ${grade} - ${topicName}</span>
        <span><i class="fas fa-keyboard"></i> Nhập đáp án vào ô trống</span>
    `;
    container.appendChild(infoBar);

    questions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.style.cssText = 'background: white; border-radius: 20px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;';
        card.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px;">
                <div style="background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; width: 36px; height: 36px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">${idx + 1}</div>
                <div style="flex: 1; font-size: 17px; font-weight: 500; line-height: 1.4;">${q.text}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; margin-left: 52px;">
                <span style="font-weight: 600; color: #475569;">Đáp án:</span>
                <input type="number" id="answer_${idx}" step="any" style="flex: 1; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 16px; transition: all 0.2s;" placeholder="Nhập kết quả...">
                <span style="color: #94a3b8; font-size: 14px;">đơn vị</span>
            </div>
        `;
        container.appendChild(card);
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn-submit';
    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Nộp bài và xem kết quả';
    submitBtn.style.cssText = 'background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; border: none; width: 100%; padding: 16px; border-radius: 60px; font-weight: 700; font-size: 16px; cursor: pointer; margin-top: 20px; display: flex; align-items: center; justify-content: center; gap: 10px;';
    submitBtn.onclick = submitQuiz;
    container.appendChild(submitBtn);
    
    document.getElementById('resultContainer').style.display = 'none';
}

function showLoading(show) {
    const container = document.getElementById('quizContainer');
    if (show) {
        container.innerHTML = `
            <div class="loading-container" style="text-align: center; padding: 60px;">
                <div class="spinner" style="width: 50px; height: 50px; border: 4px solid #e2e8f0; border-top-color: #06b6d4; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <h3 style="margin-top: 16px;">🤖 AI đang tạo câu hỏi...</h3>
                <p style="color: #64748b; margin-top: 8px;">Vui lòng chờ trong giây lát</p>
                <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
            </div>
        `;
    }
}

function showErrorMessage(error) {
    const container = document.getElementById('quizContainer');
    container.innerHTML = `
        <div style="background: #fef2f2; border-radius: 24px; padding: 60px 40px; text-align: center;">
            <i class="fas fa-circle-exclamation" style="font-size: 56px; color: #ef4444; margin-bottom: 20px;"></i>
            <h3 style="margin-bottom: 16px; color: #991b1b;">⚠️ Không thể tải câu hỏi</h3>
            <p style="color: #64748b; margin-bottom: 16px;">${error.message || 'Lỗi kết nối đến AI'}</p>
            <div style="background: #fef9c3; padding: 16px; border-radius: 12px; margin: 20px 0; text-align: left;">
                <p style="color: #854d0e; margin-bottom: 12px;"><strong>🔧 Hướng dẫn xử lý:</strong></p>
                <ul style="color: #854d0e; margin-left: 20px;">
                    <li>✅ Kiểm tra kết nối Internet</li>
                    <li>✅ Thử tải lại trang (F5)</li>
                    <li>✅ Thử đổi lớp hoặc chủ đề khác</li>
                    <li>✅ Thử lại sau vài phút</li>
                </ul>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
                <button id="retryBtn" style="background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; border: none; padding: 12px 28px; border-radius: 40px; font-weight: 600; cursor: pointer;">🔄 Thử lại</button>
                <button id="changeTopicBtn" style="background: #f1f5f9; color: #475569; border: none; padding: 12px 28px; border-radius: 40px; font-weight: 600; cursor: pointer;">📚 Đổi chủ đề</button>
            </div>
        </div>
    `;
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) retryBtn.onclick = () => loadNewQuestions(true);
    
    const changeTopicBtn = document.getElementById('changeTopicBtn');
    if (changeTopicBtn) {
        changeTopicBtn.onclick = () => {
            document.getElementById('topic').scrollIntoView({ behavior: 'smooth' });
        };
    }
}

// ==================== CHẤM ĐIỂM (DẠNG NHẬP ĐÁP ÁN) ====================
function submitQuiz() {
    let score = 0;
    const answers = [];
    
    currentQuestions.forEach((q, idx) => {
        const inputEl = document.getElementById(`answer_${idx}`);
        const userAnswer = inputEl ? parseFloat(inputEl.value) : NaN;
        const isCorrect = !isNaN(userAnswer) && Math.abs(userAnswer - q.answer) < 0.01;
        if (isCorrect) score++;
        
        answers.push({
            question: q.text,
            userAnswer: isNaN(userAnswer) ? 'Chưa nhập' : userAnswer,
            correctAnswer: q.answer,
            isCorrect: isCorrect,
            explanation: q.explanation
        });
    });

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
                <div class="detailed-answer ${ans.isCorrect ? 'correct' : 'wrong'}" style="background: ${ans.isCorrect ? '#f0fdf4' : '#fef2f2'}; border-left: 4px solid ${ans.isCorrect ? '#10b981' : '#ef4444'}; padding: 16px; margin: 12px 0; border-radius: 12px;">
                    <strong>Câu ${i+1}: ${ans.question}</strong><br>
                    📝 Bạn: ${ans.userAnswer}<br>
                    ✅ Đáp án đúng: ${ans.correctAnswer}<br>
                    💡 ${ans.explanation}
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
        console.error('Error:', error);
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

    window.toggleHistory = toggleHistory;
    loadNewQuestions();
});