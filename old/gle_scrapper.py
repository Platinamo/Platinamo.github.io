import requests
from bs4 import BeautifulSoup
import json
from urllib.parse import urljoin
import os
import time  # Add this import for the sleep function

# Function to fetch and parse a webpage
def fetch_page(url):
    response = requests.get(url)
    if response.status_code == 200:
        return BeautifulSoup(response.text, 'html.parser')
    else:
        print(f"Failed to retrieve {url}")
        return None

# Function to extract all URLs from the specified class
def extract_button_urls(soup, base_url):
    urls = []
    buttons = soup.select('a.elementor-button.elementor-button-link.elementor-size-sm')
    for button in buttons:
        # Join the base URL with the relative URL
        full_url = urljoin(base_url, button['href'])
        urls.append(full_url)
    return urls

# Function to download an image
def download_image(image_url, folder, filename):
    # Create the folder if it doesn't exist
    if not os.path.exists(folder):
        os.makedirs(folder)

    # Download the image
    response = requests.get(image_url)
    if response.status_code == 200:
        filepath = os.path.join(folder, filename)
        with open(filepath, 'wb') as f:
            f.write(response.content)
        print(f"Downloaded {filename} to {folder}")
    else:
        print(f"Failed to download {image_url}")

# Function to extract and print all image sources
def extract_and_print_image_sources(soup):
    # Find all <img> tags on the page
    images = soup.find_all('img')
    
    # Print all image sources
    print("All image sources on the page:")
    for index, img in enumerate(images):
        if 'src' in img.attrs:
            print(f"Image {index + 1}: {img['src']}")
        else:
            print(f"Image {index + 1}: No 'src' attribute found.")

# Function to select and download the 3rd image
def select_and_download_third_image(soup, folder, title):
    # Find all <img> tags on the page
    images = soup.find_all('img')
    
    # Check if there are at least 3 images
    if len(images) >= 2:
        third_image = images[1]  # Indexing starts from 0, so the third image is at index 2
        if 'src' in third_image.attrs:
            image_url = third_image['src']
            print(f"Third image source URL: {image_url}")

            # Use the product title as the filename
            filename = f"{title}.jpg"
            # Replace invalid characters in the filename
            filename = "".join(c if c.isalnum() else "_" for c in filename)
            # Download the third image
            download_image(image_url, folder, filename)
        else:
            print("The third <img> tag does not have a 'src' attribute.")
    else:
        print("There are fewer than 3 <img> tags on the page.")

# Function to extract product details from a product page
def extract_product_details(soup, base_url):
    product_details = {}

    # Extract the product title
    title = soup.find('h1', class_='product_title entry-title elementor-heading-title elementor-size-default')
    if title:
        product_details['title'] = title.text.strip()

    # Extract all items and prices from the label-meta-container
    label_meta_containers = soup.find_all('div', class_='label-meta-container')
    items = []
    for label_meta in label_meta_containers:
        item_name = label_meta.find('p', class_='wwob-item-name')
        item_price = label_meta.find('span', class_='wwobinput_price')
        if item_name and item_price:
            items.append({
                'item_name': item_name.text.strip(),
                'item_price': item_price.text.strip()
            })
    product_details['items'] = items

    # Extract input fields from the form
    form_row = soup.find('div', class_='form-row ppom-rendering-fields align-items-center ppom-section-collapse')
    if form_row:
        inputs = form_row.find_all('input')
        input_details = []
        for input_field in inputs:
            input_type = input_field.get('type', '')
            input_name = input_field.get('name', '')
            input_details.append({'type': input_type, 'name': input_name})
        product_details['input_fields'] = input_details

    # Extract and print all image sources
    extract_and_print_image_sources(soup)

    # Select and download the 3rd image
    if 'title' in product_details:
        select_and_download_third_image(soup, 'assets/games', product_details['title'])
    else:
        print("No product title found. Skipping image download.")

    return product_details

# Main function to scrape the website
def scrape_website(base_url):
    # Fetch the main page
    main_page_soup = fetch_page(base_url)
    if not main_page_soup:
        return

    # Extract button URLs
    button_urls = extract_button_urls(main_page_soup, base_url)
    if not button_urls:
        print("No button URLs found.")
        return

    # List to store all product details
    all_products = []

    # Process each button URL
    for i, button_url in enumerate(button_urls):
        print(f"Processing {button_url}...")
        product_page_soup = fetch_page(button_url)
        if product_page_soup:
            product_details = extract_product_details(product_page_soup, base_url)
            all_products.append(product_details)
        
        # Add a one-minute break after each page, except the last one
        if i < len(button_urls) - 1:
            print("Taking a one-minute break before processing the next page...")
            time.sleep(60)

    # Save the data to a JSON file
    with open('products.json', 'w', encoding='utf-8') as f:
        json.dump(all_products, f, ensure_ascii=False, indent=4)
    print("Data saved to products.json")

# Run the scraper
website_url = "https://gle-shop.com/"
scrape_website(website_url)