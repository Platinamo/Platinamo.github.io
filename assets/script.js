async function getExchangeRate() {
	const apiKey = "45f68315a3ff4fb6b11ff20fd0137f8e"; // Replace 'YOUR_API_KEY' with your actual API key
	const response = await fetch(
		`https://open.er-api.com/v6/latest/USD?app_id=${apiKey}`
	);
	const data = await response.json();
	return data.rates.BDT;
}

async function calculate() {
	let usdAmount = parseFloat(document.getElementById("usdInput").value);
	console.log(`Inserted Amount: ${usdAmount}`);
	let conversionRate = await getExchangeRate();
	console.log(`Conversion Rate: ${conversionRate}`);
	conversionRate = conversionRate + 12;
	console.log(`Edited Conversion Rate: ${conversionRate}`);
	let bdtAmount = usdAmount * conversionRate;
	console.log(`BDT Amount: ${bdtAmount}`);

	let sellingRate = bdtAmount;

	let websiteType = document.getElementById("websiteType").value;

	if (websiteType === "entertainment") {
		let hasBIN = confirm("Do you have a BIN number?");
		if (hasBIN) {
			sellingRate = sellingRate + sellingRate * 0.15;
			console.log(`BIN: ${sellingRate}`);
		} else {
			sellingRate = sellingRate + sellingRate * 0.35;
			console.log(`No BIN: ${sellingRate}`);
		}
	}

	sellingRate = sellingRate + sellingRate * 0.05;
	sellingRate = Math.round(sellingRate); // Adding 5% profit
	console.log(`Profit: ${sellingRate}`);

	let outputElement = document.getElementById("output");
	outputElement.innerHTML = "Actual Selling Rate: " + sellingRate + " BDT";
}
