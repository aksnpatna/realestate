import requests
import json

headers = {'User-Agent': 'RealEstateApp/1.0'}

def get_coords(name):
    url = f"https://nominatim.openstreetmap.org/search?q={name}, Point Cook, VIC, Australia&format=json"
    res = requests.get(url, headers=headers).json()
    if res:
        print(f"{name}: [{res[0]['lat']}, {res[0]['lon']}]")
    else:
        # try without suburb just in case
        url2 = f"https://nominatim.openstreetmap.org/search?q={name}, VIC, Australia&format=json"
        res2 = requests.get(url2, headers=headers).json()
        if res2:
            print(f"{name}: [{res2[0]['lat']}, {res2[0]['lon']}] (without suburb)")
        else:
            print(f"{name}: Not found")

get_coords("Alamanda K-9 College")
get_coords("Emmanuel College")
get_coords("Carranballac College")
get_coords("Saltwater P-9 College")
get_coords("Featherbrook P-9 College")
get_coords("Point Cook P-9 College")
get_coords("Stella Maris Catholic Primary School")
