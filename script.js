// Function to calculate health score
function calculateHealthScore(food) {
    if (!food.foodNutrients) {
        console.warn('Food nutrients data is missing:', food);
        return 'N/A'; // Return 'N/A' if nutrients data is missing
    }

    const nutrients = Object.fromEntries(food.foodNutrients.map(n => [n.nutrientName, n.value || 0]));
    const carbs = nutrients['Carbohydrate, by difference'] || 0;
    const protein = nutrients['Protein'] || 0;
    const sugars = nutrients['Total Sugars'] || 0;
    const fats = nutrients['Total lipid (fat)'] || 0;

    let score = 100;

    score -= carbs;
    score -= sugars;
    score += protein * 2;

    if (fats > 20) score -= 10; // Penalize foods high in fat

    const flags = (food.ingredients || '').toLowerCase();
    if (flags.includes('red 40') || flags.includes('gmo') || flags.includes('pesticide')) {
        score -= 20; // Deduct for harmful ingredients
    }

    if (food.dataType === 'Branded') {
        score -= 15; // Branded foods are penalized
    }

    return Math.max(score, 0); // Ensure score is not negative
}

// Fetch all food data without a progress bar
async function fetchAllFoodData(query) {
    const pageSize = 5000; // Max items per page
    const apiUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=fii8cRg2ZH1j7MWvIziQZlUy1cWQLiglbFXqORfV&query=${query}&pageSize=${pageSize}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log(`Fetched ${data.foods.length} foods from API`);
        return data.foods || [];
    } catch (error) {
        console.error('Error fetching food data:', error);
        return [];
    }
}

function renderFoods(foods) {
    console.log(`Rendering ${foods.length} foods`);
    const foodList = document.getElementById('food-list');
    foodList.innerHTML = foods
        .map(food => `
            <div class="food-item">
                <h3>${food.name}</h3>
                <p><strong>Health Score:</strong> ${food.score}</p>
                <p><strong>Protein:</strong> ${food.protein} g</p>
                <p><strong>Carbohydrates:</strong> ${food.carbs} g</p>
                <p><strong>Total Sugars:</strong> ${food.sugars} g</p>
                <p><strong>Total Fat:</strong> ${food.fats} g</p>
                <p><strong>Company:</strong> ${food.company}</p>
                ${
                    food.company !== 'Unknown'
                        ? `<button class="search-button" onclick="window.open('https://www.google.com/search?q=${encodeURIComponent(food.name + ' ' + food.company)}', '_blank')">
                            Search Link
                           </button>`
                        : ''
                }
            </div>
        `)
        .join('');
}



// Rank foods and display results
async function rankFoods(event) {
    event.preventDefault();

    const category = document.getElementById('category').value;
    const includeUnknown = document.getElementById('include-unknown').value;
    const searchQuery = document.getElementById('search').value || 'apple';
    const numFoods = parseInt(document.getElementById('num-foods').value, 10) || 50; // Default to 50

    console.log(`User requested ${numFoods} foods to display`);
    const foodList = document.getElementById('food-list');
    foodList.innerHTML = '<p>Loading...</p>';

    try {
        const foods = await fetchAllFoodData(searchQuery);

        const rankedFoods = foods.map(food => {
            const nutrients = Object.fromEntries(food.foodNutrients?.map(n => [n.nutrientName, n.value || 'N/A']) || []);
            const carbs = nutrients['Carbohydrate, by difference'] || 'N/A';
            const protein = nutrients['Protein'] || 'N/A';
            const sugars = nutrients['Total Sugars'] || 'N/A';
            const fats = nutrients['Total lipid (fat)'] || 'N/A';

            const company = food.brandOwner || 'Unknown';
            const score = calculateHealthScore(food);

            return {
                name: food.description,
                score,
                carbs,
                protein,
                sugars,
                fats,
                company,
            };
        });

        // Filter foods by category
        const filteredFoods = rankedFoods.filter(food => {
            const includeFood =
                includeUnknown === 'yes' ||
                (food.carbs !== 'N/A' && food.sugars !== 'N/A' && food.fats !== 'N/A');

            if (!includeFood) return false;

            const numericScore = parseFloat(food.score);
            if (category === 'no_filter') return true;
            if (category === 'extremely_unhealthy') return numericScore < 40;
            if (category === 'unhealthy') return numericScore >= 40 && numericScore < 60;
            if (category === 'bare_minimum_healthy') return numericScore >= 60 && numericScore < 80;
            if (category === 'really_healthy') return numericScore >= 80 && numericScore < 90;
            if (category === 'most_healthy') return numericScore >= 90;
            return false;
        });

        console.log(`Filtered down to ${filteredFoods.length} foods`);

        // Sort foods by health score (descending)
        filteredFoods.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));

        // Display only the requested number of foods
        const foodsToRender = filteredFoods.slice(0, Math.min(numFoods, filteredFoods.length));
        console.log(`Rendering ${foodsToRender.length} foods out of ${filteredFoods.length}`);
        renderFoods(foodsToRender);
    } catch (error) {
        console.error('Error fetching or processing foods:', error);
        foodList.innerHTML = '<p>An error occurred while fetching data. Please try again later.</p>';
    }
}

document.getElementById('fetch-foods').addEventListener('click', rankFoods);
