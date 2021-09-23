const config = {
    module:{
      rules:[
        {
          test: /\.(glb|gltf)$/,
          use: [
            {
              loader: "file-loader",
              options:
              {
                outputPath: 'models/gltf/'
              }
            }
          ]
        }
      ]
    }
}