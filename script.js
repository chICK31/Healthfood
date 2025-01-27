async function fetchFoodData(query) {
    const apiUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=fii8cRg2ZH1j7MWvIziQZlUy1cWQLiglbFXqORfV&query=${query}`; // Replace with your API key
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        return data.foods || []; // Return an empty array if foods is undefined
    } catch (error) {
        console.error('Error fetching food data:', error);
        throw error; // Rethrow the error to handle it in the caller
    }
}

function calculateHealthScore(food) {
    if (!food.foodNutrients) {
        console.warn('Food nutrients data is missing:', food);
        return 'N/A'; // Return 'N/A' if nutrients data is missing
    }

    console.log('Nutrient Data:', food.foodNutrients.map(n => n.nutrientName));

    const carbs = food.foodNutrients.find(n => n.nutrientName === 'Carbohydrate, by difference')?.value || 0;
    const protein = food.foodNutrients.find(n => n.nutrientName === 'Protein')?.value || 0;
    const sugars = food.foodNutrients.find(n => n.nutrientName === 'Total Sugars')?.value || 0;
    const flags = (food.ingredients || '').toLowerCase();

    let score = 100;

    score -= carbs || 0;
    score -= sugars || 0;
    score += protein * 2;

    if (flags.includes('red 40') || flags.includes('gmo') || flags.includes('pesticide')) {
        score -= 20;
    }

    if (food.dataType === 'Branded') {
        score -= 15;
    }

    return Math.max(score, 0); // Ensure score is not negative
}

async function rankFoods(event) {
    // Prevent form submission from refreshing the page
    event.preventDefault();

    const category = document.getElementById('category').value;
    const includeUnknown = document.getElementById('include-unknown').value;
    const searchQuery = document.getElementById('search').value || 'apple';
    const foodList = document.getElementById('food-list');
    foodList.innerHTML = '<p>Loading...</p>';

    try {
        const foods = await fetchFoodData(searchQuery);
        console.log('Fetched foods:', foods);

        if (!foods.length) {
            foodList.innerHTML = '<p>No foods found. Please try a different search query.</p>';
            return;
        }

        const rankedFoods = foods.map(food => {
            const carbs = food.foodNutrients?.find(n => n.nutrientName === 'Carbohydrate, by difference')?.value || 'N/A';
            const protein = food.foodNutrients?.find(n => n.nutrientName === 'Protein')?.value || 'N/A';
            const sugars = food.foodNutrients?.find(n => n.nutrientName === 'Total Sugars')?.value || 'N/A';

            const company = food.brandOwner || 'Unknown';
            const score = calculateHealthScore(food);

            return {
                name: food.description,
                score: carbs === 'N/A' || sugars === 'N/A' ? `${score} (unknown)` : score,
                carbs,
                protein,
                sugars,
                company,
                ingredients: food.ingredients || 'N/A',
            };
        });

        const filteredFoods = rankedFoods.filter(food => {
            const includeFood =
                includeUnknown === 'yes' ||
                (food.carbs !== 'N/A' && food.sugars !== 'N/A' && food.ingredients !== 'N/A');

            if (!includeFood) return false;

            const numericScore = parseFloat(food.score);
            if (category === 'extremely_unhealthy') return numericScore < 40;
            if (category === 'unhealthy') return numericScore >= 40 && numericScore < 60;
            if (category === 'bare_minimum_healthy') return numericScore >= 60 && numericScore < 80;
            if (category === 'really_healthy') return numericScore >= 80 && numericScore < 90;
            if (category === 'most_healthy') return numericScore >= 90;
            return false;
        });

        console.log('Filtered foods:', filteredFoods);

        filteredFoods.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

        foodList.innerHTML = filteredFoods.map(food => `
            <div class="food-item">
                <div>
                    <h3>${food.name}</h3>
                    <p><strong>Health Score:</strong> ${food.score}</p>
                    <p><strong>Carbohydrates:</strong> ${food.carbs} g</p>
                    <p><strong>Protein:</strong> ${food.protein} g</p>
                    <p><strong>Sugars:</strong> ${food.sugars} g</p>
                    <p><strong>Company:</strong> ${food.company}</p>
                    <p><strong>Ingredients:</strong> ${food.ingredients}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error fetching or processing foods:', error);
        foodList.innerHTML = '<p>An error occurred while fetching data. Please try again later.</p>';
    }
}

document.getElementById('fetch-foods').addEventListener('click', rankFoods);
