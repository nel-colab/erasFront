pipeline {
    agent any

    environment {
        IMAGE_NAME = 'eras-frontend'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Image (Staging)') {
            when {
                branch 'develop'
            }
            steps {
                sh """
                    cp /etc/eras-frontend-staging/.env .env || true
                    docker build -t ${IMAGE_NAME}:${GIT_COMMIT} .
                """
            }
        }

        stage('Build Image (Production)') {
            when {
                branch 'main'
            }
            steps {
                sh """
                    cp /etc/eras-frontend/.env .env || true
                    docker build -t ${IMAGE_NAME}:${GIT_COMMIT} .
                """
            }
        }

        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                sh """
                    docker stop ${IMAGE_NAME}-staging || true
                    docker rm ${IMAGE_NAME}-staging || true
                    docker run -d \\
                        --name ${IMAGE_NAME}-staging \\
                        --restart unless-stopped \\
                        -p 3001:80 \\
                        ${IMAGE_NAME}:${GIT_COMMIT}
                    sudo cp nginx/staging.erastcg.com /etc/nginx/sites-enabled/staging.erastcg.com
                    sudo nginx -t && sudo systemctl reload nginx
                """
            }
        }

        stage('Approve Production Deploy') {
            when {
                branch 'main'
            }
            steps {
                timeout(time: 30, unit: 'MINUTES') {
                    input message: 'Deploy to production?', ok: 'Deploy'
                }
            }
        }

        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                sh """
                    docker stop ${IMAGE_NAME}-prod || true
                    docker rm ${IMAGE_NAME}-prod || true
                    docker run -d \\
                        --name ${IMAGE_NAME}-prod \\
                        --restart unless-stopped \\
                        -p 3000:80 \\
                        ${IMAGE_NAME}:${GIT_COMMIT}
                    sudo cp nginx/erastcg.com /etc/nginx/sites-enabled/erastcg.com
                    sudo nginx -t && sudo systemctl reload nginx
                """
            }
        }
    }

    post {
        failure {
            echo 'Pipeline failed.'
        }
        success {
            echo 'Pipeline completed successfully.'
        }
    }
}
