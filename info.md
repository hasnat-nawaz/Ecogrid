ecogrid-key=napi_3na7zgeit0vsmiaeoq9bfeb606z12c89lgfpys5hucg8785vydel6hhbbl455grr

curl --request PATCH \
     --url https://console.neon.tech/api/v2/projects/gentle-river-36876104/endpoints/
ep-floral-snow-aohrd2gz \
     --header 'accept: application/json' \
     --header 'authorization: Bearer napi_3na7zgeit0vsmiaeoq9bfeb606z12c89lgfpys5hucg8785vydel6hhbbl455grr' \
     --header 'content-type: application/json' \
     --data '  
{              
  "endpoint": {
    "settings": {
      "pg_settings": {
        "cron.database_name": "ecogrid"
      }
    }
  }
}
'


curl --request PATCH \
     --url https://console.neon.tech/api/v2/projects/proud-silence-57350683/endpoints
/ep-floral-dream-aovcqtdk \
     --header 'accept: application/json' \
     --header 'authorization: Bearer napi_3na7zgeit0vsmiaeoq9bfeb606z12c89lgfpys5hucg8785vydel6hhbbl455grr' \
     --header 'content-type: application/json' \
     --data '
{              
  "endpoint": {
    "settings": {
      "pg_settings": {
        "cron.database_name": "ecogrid-db"
      }
    }
  }
}
'


napi_267u67d0saubran57xq8qm8sc1mhpq694wzpqjeum5ull2qrwkn84orumjnm98df
